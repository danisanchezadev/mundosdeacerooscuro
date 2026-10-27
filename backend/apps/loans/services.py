"""Domain logic for loans and reservations.

Loan lifecycle::

    REQUESTED -> APPROVED -> BORROWED -> RETURN_PENDING -> RETURN_CONFIRMED
         \\          \\            \\              \\-> LOST
          \\-> CANCELLED         \\-> LOST

A return needs the confirmation of both the owner and the borrower. The first
confirmation moves the loan to RETURN_PENDING, the second one closes it.
"""
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import ACTIVE_STATUSES, Loan, LoanStatus, Reservation, UserBook


# ------------------------------------------------------------------ helpers
def _locked_loan(loan: Loan) -> Loan:
    return Loan.objects.select_for_update().select_related("user_book__book").get(pk=loan.pk)


def _require_owner(loan: Loan, actor):
    if loan.owner_id != actor.id:
        raise PermissionDenied("Solo el propietario del ejemplar puede realizar esta acción.")


def _require_participant(loan: Loan, actor):
    if actor.id not in (loan.owner_id, loan.borrower_id):
        raise PermissionDenied("No participas en este préstamo.")


def _require_status(loan: Loan, *statuses):
    if loan.status not in statuses:
        raise ValidationError(f"Acción no permitida en el estado actual del préstamo ({loan.status}).")


def allowed_actions(loan: Loan, user) -> list[str]:
    """Actions the given user can currently perform on a loan (used by the UI)."""
    if not user or not user.is_authenticated:
        return []
    actions: list[str] = []
    is_owner = loan.owner_id == user.id
    is_borrower = loan.borrower_id == user.id
    if loan.status == LoanStatus.REQUESTED:
        if is_owner:
            actions.append("approve")
        if is_owner or is_borrower:
            actions.append("cancel")
    elif loan.status == LoanStatus.APPROVED:
        if is_owner:
            actions.append("mark_borrowed")
        if is_owner or is_borrower:
            actions.append("cancel")
    elif loan.status in (LoanStatus.BORROWED, LoanStatus.RETURN_PENDING):
        already = loan.owner_confirmed_return if is_owner else loan.borrower_confirmed_return
        if (is_owner or is_borrower) and not already:
            actions.append("confirm_return")
        if is_owner:
            actions.append("mark_lost")
    return actions


# ------------------------------------------------------------------ reservations
def resequence_queue(book_id: int) -> None:
    active = Reservation.objects.filter(book_id=book_id, active=True).order_by("queue_position", "created_at", "id")
    for position, reservation in enumerate(active, start=1):
        if reservation.queue_position != position:
            Reservation.objects.filter(pk=reservation.pk).update(queue_position=position)


@transaction.atomic
def create_reservation(user, book) -> Reservation:
    offered = UserBook.objects.filter(book=book, available_for_loan=True).exclude(owner=user)
    if not offered.exists():
        raise ValidationError("Este libro no tiene ejemplares ofrecidos para préstamo por otros usuarios.")
    if UserBook.objects.free().filter(book=book).exclude(owner=user).exists():
        raise ValidationError("Hay ejemplares disponibles ahora mismo: solicita el préstamo directamente.")
    if Reservation.objects.filter(user=user, book=book, active=True).exists():
        raise ValidationError("Ya tienes una reserva activa para este libro.")
    position = Reservation.objects.filter(book=book, active=True).count() + 1
    return Reservation.objects.create(user=user, book=book, queue_position=position)


@transaction.atomic
def cancel_reservation(reservation: Reservation) -> Reservation:
    if reservation.active:
        reservation.active = False
        reservation.save(update_fields=["active"])
        resequence_queue(reservation.book_id)
    return reservation


# ------------------------------------------------------------------ loans
def _check_reservation_queue(borrower, book) -> None:
    free_copies = UserBook.objects.free().filter(book=book).exclude(owner=borrower).count()
    queue = list(Reservation.objects.filter(book=book, active=True).order_by("queue_position"))
    if not queue:
        return
    mine = next((r for r in queue if r.user_id == borrower.id), None)
    if mine is not None:
        if mine.queue_position > free_copies:
            raise ValidationError(
                f"Estás en la posición {mine.queue_position} de la cola y hay {free_copies} ejemplar(es) libre(s)."
            )
    elif len(queue) >= free_copies:
        raise ValidationError("Los ejemplares libres están reservados para usuarios en cola de espera.")


@transaction.atomic
def request_loan(borrower, user_book: UserBook) -> Loan:
    copy = UserBook.objects.select_for_update().select_related("book").get(pk=user_book.pk)
    if copy.owner_id == borrower.id:
        raise ValidationError("No puedes solicitar el préstamo de tu propio ejemplar.")
    if not copy.available_for_loan:
        raise ValidationError("Este ejemplar no está disponible para préstamo.")
    if Loan.objects.filter(user_book=copy, status__in=ACTIVE_STATUSES).exists():
        raise ValidationError("Este ejemplar está prestado actualmente. Puedes reservar el libro.")
    if Loan.objects.filter(user_book=copy, borrower=borrower, status=LoanStatus.REQUESTED).exists():
        raise ValidationError("Ya has solicitado este ejemplar.")
    _check_reservation_queue(borrower, copy.book)

    loan = Loan.objects.create(owner=copy.owner, borrower=borrower, user_book=copy)
    reservation = Reservation.objects.filter(user=borrower, book=copy.book, active=True).first()
    if reservation:
        cancel_reservation(reservation)
    return loan


@transaction.atomic
def approve_loan(loan: Loan, actor) -> Loan:
    loan = _locked_loan(loan)
    _require_owner(loan, actor)
    _require_status(loan, LoanStatus.REQUESTED)
    if not loan.user_book.available_for_loan:
        raise ValidationError("El ejemplar ya no está disponible para préstamo.")
    if Loan.objects.filter(user_book=loan.user_book, status__in=ACTIVE_STATUSES).exists():
        raise ValidationError("El ejemplar ya está comprometido con otro préstamo.")
    loan.status = LoanStatus.APPROVED
    loan.approved_at = timezone.now()
    loan.save(update_fields=["status", "approved_at"])
    Loan.objects.filter(user_book=loan.user_book, status=LoanStatus.REQUESTED).exclude(pk=loan.pk).update(
        status=LoanStatus.CANCELLED
    )
    return loan


@transaction.atomic
def cancel_loan(loan: Loan, actor) -> Loan:
    loan = _locked_loan(loan)
    _require_participant(loan, actor)
    _require_status(loan, LoanStatus.REQUESTED, LoanStatus.APPROVED)
    loan.status = LoanStatus.CANCELLED
    loan.save(update_fields=["status"])
    return loan


@transaction.atomic
def mark_borrowed(loan: Loan, actor) -> Loan:
    loan = _locked_loan(loan)
    _require_owner(loan, actor)
    _require_status(loan, LoanStatus.APPROVED)
    loan.status = LoanStatus.BORROWED
    loan.borrowed_at = timezone.now()
    loan.save(update_fields=["status", "borrowed_at"])
    return loan


@transaction.atomic
def confirm_return(loan: Loan, actor) -> Loan:
    loan = _locked_loan(loan)
    _require_participant(loan, actor)
    _require_status(loan, LoanStatus.BORROWED, LoanStatus.RETURN_PENDING)
    field = "owner_confirmed_return" if loan.owner_id == actor.id else "borrower_confirmed_return"
    if getattr(loan, field):
        raise ValidationError("Ya has confirmado la devolución; falta la confirmación de la otra parte.")
    setattr(loan, field, True)
    if loan.owner_confirmed_return and loan.borrower_confirmed_return:
        loan.status = LoanStatus.RETURN_CONFIRMED
        loan.returned_at = timezone.now()
    else:
        loan.status = LoanStatus.RETURN_PENDING
    loan.save(update_fields=[field, "status", "returned_at"])
    return loan


@transaction.atomic
def mark_lost(loan: Loan, actor) -> Loan:
    loan = _locked_loan(loan)
    _require_owner(loan, actor)
    _require_status(loan, LoanStatus.BORROWED, LoanStatus.RETURN_PENDING)
    loan.status = LoanStatus.LOST
    loan.save(update_fields=["status"])
    UserBook.objects.filter(pk=loan.user_book_id).update(available_for_loan=False)
    return loan
