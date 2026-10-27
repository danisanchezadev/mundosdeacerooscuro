import pytest

from apps.loans.models import Loan, LoanStatus, Reservation, UserBook

pytestmark = pytest.mark.django_db


def request_loan(client, copy):
    return client.post("/api/loans/", {"user_book": copy.id}, format="json")


def act(client, loan_id, action):
    return client.post(f"/api/loans/{loan_id}/{action}/")


@pytest.fixture
def borrower_client(user_client):
    return user_client


@pytest.fixture
def owner_client(client_for, other_user):
    return client_for(other_user)


# ------------------------------------------------------------------ user books
def test_user_offers_copy_and_sees_it_on_book(user_client, user, book, api_client):
    created = user_client.post(
        "/api/user-books/", {"book": book.id, "notes": "<b>Tapa dura</b>", "available_for_loan": True}, format="json"
    )
    assert created.status_code == 201, created.content
    assert created.data["owner"]["id"] == user.id
    assert created.data["notes"] == "Tapa dura"
    assert api_client.get(f"/api/user-books/?book={book.id}").data["count"] == 1
    assert user_client.get("/api/user-books/?mine=true").data["count"] == 1


def test_mine_filter_is_empty_for_anonymous(api_client, copy):
    # `mine=true` for visitors must not leak anything user specific
    assert api_client.get("/api/user-books/?mine=true").data["count"] == 0


def test_visitor_cannot_offer_and_only_owner_can_edit(api_client, book, copy, user_client, owner_client):
    assert api_client.post("/api/user-books/", {"book": book.id}, format="json").status_code == 401
    url = f"/api/user-books/{copy.id}/"
    assert user_client.patch(url, {"available_for_loan": False}, format="json").status_code == 403
    assert owner_client.patch(url, {"available_for_loan": False}, format="json").data["available_for_loan"] is False
    assert owner_client.patch(url, {"book": book.id}, format="json").status_code == 200


def test_copy_book_cannot_change(owner_client, copy, author):
    from apps.books.models import Book

    other = Book.objects.create(title="Otro", author=author)
    assert owner_client.patch(f"/api/user-books/{copy.id}/", {"book": other.id}, format="json").status_code == 400


def test_copy_with_loans_cannot_be_deleted(owner_client, borrower_client, copy):
    assert request_loan(borrower_client, copy).status_code == 201
    response = owner_client.delete(f"/api/user-books/{copy.id}/")
    assert response.status_code == 400
    assert UserBook.objects.filter(pk=copy.pk).exists()


def test_copy_without_loans_can_be_deleted(owner_client, copy):
    assert owner_client.delete(f"/api/user-books/{copy.id}/").status_code == 204


# ------------------------------------------------------------------ loan flow
def test_full_loan_lifecycle_with_double_return_confirmation(borrower_client, owner_client, copy, user, other_user):
    created = request_loan(borrower_client, copy)
    assert created.status_code == 201, created.content
    loan_id = created.data["id"]
    assert created.data["status"] == "REQUESTED"
    assert created.data["borrower"]["id"] == user.id and created.data["owner"]["id"] == other_user.id
    assert created.data["allowed_actions"] == ["cancel"]

    approved = act(owner_client, loan_id, "approve")
    assert approved.data["status"] == "APPROVED" and approved.data["approved_at"]
    assert set(approved.data["allowed_actions"]) == {"mark_borrowed", "cancel"}

    borrowed = act(owner_client, loan_id, "mark-borrowed")
    assert borrowed.data["status"] == "BORROWED" and borrowed.data["borrowed_at"]

    first = act(borrower_client, loan_id, "confirm-return")
    assert first.data["status"] == "RETURN_PENDING"
    assert first.data["borrower_confirmed_return"] and not first.data["owner_confirmed_return"]
    assert act(borrower_client, loan_id, "confirm-return").status_code == 400  # cannot confirm twice

    closed = act(owner_client, loan_id, "confirm-return")
    assert closed.data["status"] == "RETURN_CONFIRMED" and closed.data["returned_at"]

    assert borrower_client.get("/api/users/me/").data["completed_loans"] == 1
    assert owner_client.get("/api/users/me/").data["completed_loans"] == 1


def test_copy_is_unavailable_while_borrowed(borrower_client, owner_client, copy, book, api_client):
    loan_id = request_loan(borrower_client, copy).data["id"]
    act(owner_client, loan_id, "approve")
    assert api_client.get(f"/api/books/{book.id}/").data["loan_availability"] == "lent"
    assert api_client.get("/api/books/?available_for_loan=true").data["count"] == 0

    act(owner_client, loan_id, "cancel")
    assert api_client.get(f"/api/books/{book.id}/").data["loan_availability"] == "available"


def test_cannot_request_own_unavailable_or_duplicate_copy(borrower_client, owner_client, copy, user, make_user, client_for):
    assert request_loan(owner_client, copy).status_code == 400  # own copy
    assert request_loan(borrower_client, copy).status_code == 201
    assert request_loan(borrower_client, copy).status_code == 400  # duplicate

    copy.available_for_loan = False
    copy.save()
    assert request_loan(client_for(make_user()), copy).status_code == 400


def test_visitor_cannot_request_loan(api_client, copy):
    assert request_loan(api_client, copy).status_code == 401


def test_approving_one_request_cancels_competing_requests(owner_client, borrower_client, copy, make_user, client_for):
    rival = client_for(make_user())
    first = request_loan(borrower_client, copy).data["id"]
    second = request_loan(rival, copy).data["id"]
    assert act(owner_client, first, "approve").status_code == 200
    assert Loan.objects.get(pk=second).status == LoanStatus.CANCELLED
    # copy now committed: new requests are rejected
    assert request_loan(client_for(make_user()), copy).status_code == 400


def test_permissions_on_transitions(borrower_client, owner_client, copy, make_user, client_for):
    loan_id = request_loan(borrower_client, copy).data["id"]
    stranger = client_for(make_user())

    assert act(borrower_client, loan_id, "approve").status_code == 403  # borrower cannot approve
    assert act(stranger, loan_id, "approve").status_code == 404  # strangers do not even see it
    assert stranger.get("/api/loans/").data["count"] == 0
    assert act(owner_client, loan_id, "mark-borrowed").status_code == 400  # wrong state
    assert act(owner_client, loan_id, "confirm-return").status_code == 400

    act(owner_client, loan_id, "approve")
    assert act(borrower_client, loan_id, "mark-borrowed").status_code == 403
    act(owner_client, loan_id, "mark-borrowed")
    assert act(borrower_client, loan_id, "cancel").status_code == 400
    assert act(borrower_client, loan_id, "mark-lost").status_code == 403


def test_mark_lost_disables_copy(borrower_client, owner_client, copy):
    loan_id = request_loan(borrower_client, copy).data["id"]
    act(owner_client, loan_id, "approve")
    act(owner_client, loan_id, "mark-borrowed")
    lost = act(owner_client, loan_id, "mark-lost")
    assert lost.data["status"] == "LOST"
    copy.refresh_from_db()
    assert copy.available_for_loan is False


def test_loan_listing_filters(borrower_client, owner_client, copy, book):
    loan_id = request_loan(borrower_client, copy).data["id"]
    assert borrower_client.get("/api/loans/?role=borrower").data["count"] == 1
    assert borrower_client.get("/api/loans/?role=owner").data["count"] == 0
    assert owner_client.get("/api/loans/?role=owner&status=REQUESTED").data["count"] == 1
    assert owner_client.get(f"/api/loans/?book={book.id}").data["count"] == 1
    assert owner_client.get(f"/api/loans/{loan_id}/").data["book_title"] == "Dune"


def test_admin_loan_moderation(admin_client, borrower_client, copy):
    loan_id = request_loan(borrower_client, copy).data["id"]
    assert admin_client.get("/api/loans/").data["count"] == 1
    assert borrower_client.patch(f"/api/loans/{loan_id}/", {"status": "LOST"}, format="json").status_code == 403
    assert admin_client.patch(f"/api/loans/{loan_id}/", {"status": "CANCELLED"}, format="json").data["status"] == "CANCELLED"
    assert admin_client.patch(f"/api/loans/{loan_id}/", {"status": "NOPE"}, format="json").status_code == 400
    assert admin_client.delete(f"/api/loans/{loan_id}/").status_code == 204


def test_database_prevents_two_active_loans_on_same_copy(copy, user, make_user):
    from django.db import IntegrityError, transaction

    Loan.objects.create(owner=copy.owner, borrower=user, user_book=copy, status=LoanStatus.BORROWED)
    with pytest.raises(IntegrityError), transaction.atomic():
        Loan.objects.create(owner=copy.owner, borrower=make_user(), user_book=copy, status=LoanStatus.APPROVED)


# ------------------------------------------------------------------ reservations
@pytest.fixture
def lent_book(borrower_client, owner_client, copy, book):
    """A book whose only offered copy is currently lent out."""
    loan_id = request_loan(borrower_client, copy).data["id"]
    act(owner_client, loan_id, "approve")
    act(owner_client, loan_id, "mark-borrowed")
    return {"book": book, "loan_id": loan_id}


def reserve(client, book):
    return client.post("/api/reservations/", {"book": book.id}, format="json")


def test_cannot_reserve_when_copy_is_free_or_none_offered(client_for, make_user, book, author):
    from apps.books.models import Book

    client = client_for(make_user())
    assert reserve(client, book).status_code == 400  # no copies offered at all
    other = Book.objects.create(title="Sin copias", author=author)
    assert reserve(client, other).status_code == 400


def test_cannot_reserve_when_copy_free(client_for, make_user, copy, book):
    assert reserve(client_for(make_user()), book).status_code == 400


def test_reservation_queue_flow(lent_book, client_for, make_user, owner_client):
    book = lent_book["book"]
    u1, u2 = make_user(), make_user()
    c1, c2 = client_for(u1), client_for(u2)

    r1, r2 = reserve(c1, book), reserve(c2, book)
    assert r1.status_code == 201 and r2.status_code == 201
    assert (r1.data["queue_position"], r2.data["queue_position"]) == (1, 2)
    assert reserve(c1, book).status_code == 400  # duplicate
    assert c1.get("/api/reservations/").data["count"] == 1  # users only see their own
    assert c1.get(f"/api/books/{book.id}/").data["reservation_count"] == 2

    # first user leaves the queue, the second moves up
    assert c1.delete(f"/api/reservations/{r1.data['id']}/").status_code == 204
    assert Reservation.objects.get(pk=r2.data["id"]).queue_position == 1
    assert Reservation.objects.get(pk=r1.data["id"]).active is False
    assert c2.delete(f"/api/reservations/{r1.data['id']}/").status_code == 404  # not theirs


def test_queue_is_respected_when_copy_is_returned(lent_book, borrower_client, owner_client, client_for, make_user, copy):
    book = lent_book["book"]
    queued, queue_jumper = client_for(make_user()), client_for(make_user())
    reservation = reserve(queued, book)
    assert reservation.status_code == 201

    act(borrower_client, lent_book["loan_id"], "confirm-return")
    act(owner_client, lent_book["loan_id"], "confirm-return")

    # the free copy is earmarked for the user at the head of the queue
    blocked = request_loan(queue_jumper, copy)
    assert blocked.status_code == 400
    ok = request_loan(queued, copy)
    assert ok.status_code == 201
    assert Reservation.objects.get(pk=reservation.data["id"]).active is False


def test_admin_sees_all_reservations(lent_book, client_for, make_user, admin_client):
    reserve(client_for(make_user()), lent_book["book"])
    assert admin_client.get("/api/reservations/").data["count"] == 1
    assert admin_client.get("/api/reservations/?active=true").data["count"] == 1


def test_reservation_requires_authentication(api_client, book):
    assert reserve(api_client, book).status_code == 401


def test_cannot_reserve_own_only_copy(owner_client, lent_book):
    assert reserve(owner_client, lent_book["book"]).status_code == 400
