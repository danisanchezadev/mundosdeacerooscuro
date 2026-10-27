import pytest

from apps.reviews.models import Review, ReviewComment

pytestmark = pytest.mark.django_db


def make_payload(book, **overrides):
    return {"book": book.id, "title": "Obra maestra", "content": "Increíble worldbuilding.", "rating": 5, **overrides}


def test_visitor_cannot_write(api_client, book):
    assert api_client.post("/api/reviews/", make_payload(book), format="json").status_code == 401
    assert api_client.post("/api/review-comments/", {"review": 1, "content": "x"}, format="json").status_code == 401


def test_user_creates_multiple_reviews_for_same_book(user_client, user, book):
    first = user_client.post("/api/reviews/", make_payload(book), format="json")
    second = user_client.post("/api/reviews/", make_payload(book, title="Relectura", rating=4), format="json")
    assert first.status_code == 201 and second.status_code == 201
    assert first.data["user"]["id"] == user.id
    assert Review.objects.filter(user=user, book=book).count() == 2

    stats = user_client.get(f"/api/books/{book.id}/").data
    assert stats["review_count"] == 2
    assert stats["average_rating"] == 4.5


@pytest.mark.parametrize("rating", [0, 6, -1, "abc"])
def test_rating_must_be_between_1_and_5(user_client, book, rating):
    assert user_client.post("/api/reviews/", make_payload(book, rating=rating), format="json").status_code == 400


def test_review_content_is_sanitized(user_client, book):
    response = user_client.post(
        "/api/reviews/",
        make_payload(book, title="<script>alert(1)</script>Hola", content='<img src=x onerror="alert(1)">Texto'),
        format="json",
    )
    assert response.status_code == 201
    assert response.data["title"] == "Hola"
    assert response.data["content"] == "Texto"


def test_only_author_or_admin_can_edit_or_delete_review(user_client, client_for, other_user, admin_client, user, book):
    review = Review.objects.create(user=user, book=book, title="t", content="c", rating=3)
    url = f"/api/reviews/{review.id}/"

    assert client_for(other_user).patch(url, {"rating": 1}, format="json").status_code == 403
    assert client_for(other_user).delete(url).status_code == 403
    assert user_client.patch(url, {"rating": 4}, format="json").data["rating"] == 4
    assert admin_client.delete(url).status_code == 204


def test_review_book_cannot_be_changed(user_client, user, book, author):
    from apps.books.models import Book

    other_book = Book.objects.create(title="Otro", author=author)
    review = Review.objects.create(user=user, book=book, title="t", content="c", rating=3)
    response = user_client.patch(f"/api/reviews/{review.id}/", {"book": other_book.id}, format="json")
    assert response.status_code == 400


def test_review_filters_and_comment_count(api_client, user, other_user, book):
    review = Review.objects.create(user=user, book=book, title="t", content="c", rating=3)
    ReviewComment.objects.create(review=review, user=other_user, content="Opino lo contrario")
    data = api_client.get(f"/api/reviews/?book={book.id}").data
    assert data["count"] == 1
    assert data["results"][0]["comment_count"] == 1
    assert data["results"][0]["book_title"] == "Dune"
    assert api_client.get("/api/reviews/?rating=5").data["count"] == 0
    assert api_client.get(f"/api/reviews/?user={other_user.id}").data["count"] == 0


def test_comments_lifecycle(user_client, client_for, other_user, admin_client, user, book):
    review = Review.objects.create(user=user, book=book, title="t", content="c", rating=3)
    created = client_for(other_user).post(
        "/api/review-comments/", {"review": review.id, "content": "<b>Bien</b> dicho"}, format="json"
    )
    assert created.status_code == 201
    assert created.data["content"] == "Bien dicho"
    comment_id = created.data["id"]
    url = f"/api/review-comments/{comment_id}/"

    assert user_client.delete(url).status_code == 403
    assert client_for(other_user).patch(url, {"content": "Editado"}, format="json").data["content"] == "Editado"
    assert user_client.get(f"/api/review-comments/?review={review.id}").data["count"] == 1
    assert admin_client.delete(url).status_code == 204


def test_comment_cannot_be_moved_to_other_review(client_for, user, other_user, book):
    r1 = Review.objects.create(user=user, book=book, title="t", content="c", rating=3)
    r2 = Review.objects.create(user=user, book=book, title="t2", content="c", rating=3)
    comment = ReviewComment.objects.create(review=r1, user=other_user, content="hi")
    response = client_for(other_user).patch(
        f"/api/review-comments/{comment.id}/", {"review": r2.id}, format="json"
    )
    assert response.status_code == 400


def test_empty_content_rejected(user_client, book):
    assert user_client.post("/api/reviews/", make_payload(book, content="<b></b>"), format="json").status_code == 400
