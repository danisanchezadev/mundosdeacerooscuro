from django.conf import settings
from django.db import models
from django.db.models import F, Q


class LoanStatus(models.TextChoices):
    REQUESTED = "REQUESTED", "Solicitado"
    APPROVED = "APPROVED", "Aprobado"
    BORROWED = "BORROWED", "Prestado"
    RETURN_PENDING = "RETURN_PENDING", "Devolución pendiente"
    RETURN_CONFIRMED = "RETURN_CONFIRMED", "Devolución confirmada"
    CANCELLED = "CANCELLED", "Cancelado"
    LOST = "LOST", "Perdido"


# Statuses in which the physical copy is committed to a borrower.
ACTIVE_STATUSES = (LoanStatus.APPROVED, LoanStatus.BORROWED, LoanStatus.RETURN_PENDING)


class UserBookQuerySet(models.QuerySet):
    def free(self):
        """Copies offered for loan that are not currently committed to a borrower."""
        return self.filter(available_for_loan=True).exclude(loans__status__in=ACTIVE_STATUSES)


class UserBook(models.Model):
    """A physical copy of a book owned by a user."""

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="copies")
    book = models.ForeignKey("books.Book", on_delete=models.CASCADE, related_name="copies")
    available_for_loan = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = UserBookQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.book} @ {self.owner}"


class LoanQuerySet(models.QuerySet):
    def for_user(self, user):
        return self.filter(Q(owner=user) | Q(borrower=user))

    def completed_for(self, user):
        return self.for_user(user).filter(status=LoanStatus.RETURN_CONFIRMED)


class Loan(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="owned_loans")
    borrower = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="borrowed_loans"
    )
    user_book = models.ForeignKey(UserBook, on_delete=models.PROTECT, related_name="loans")
    status = models.CharField(max_length=20, choices=LoanStatus.choices, default=LoanStatus.REQUESTED, db_index=True)

    requested_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    borrowed_at = models.DateTimeField(null=True, blank=True)
    returned_at = models.DateTimeField(null=True, blank=True)

    owner_confirmed_return = models.BooleanField(default=False)
    borrower_confirmed_return = models.BooleanField(default=False)

    objects = LoanQuerySet.as_manager()

    class Meta:
        ordering = ["-requested_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["user_book"],
                condition=Q(status__in=[s.value for s in ACTIVE_STATUSES]),
                name="unique_active_loan_per_copy",
            ),
            models.CheckConstraint(condition=~Q(owner=F("borrower")), name="loan_owner_not_borrower"),
        ]

    def __str__(self):
        return f"Loan #{self.pk} {self.status}"


class Reservation(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reservations")
    book = models.ForeignKey("books.Book", on_delete=models.CASCADE, related_name="reservations")
    queue_position = models.PositiveIntegerField(default=1)
    active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["book_id", "queue_position", "created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "book"], condition=Q(active=True), name="unique_active_reservation_per_user_book"
            ),
        ]

    def __str__(self):
        return f"Reservation {self.user_id}->{self.book_id} #{self.queue_position}"
