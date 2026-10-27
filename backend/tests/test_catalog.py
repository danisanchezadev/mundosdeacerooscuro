import pytest

from apps.authors.models import Author
from apps.awards.models import Award
from apps.books.models import Book
from apps.loans.models import UserBook
from apps.reviews.models import Review
from apps.sagas.models import Saga

pytestmark = pytest.mark.django_db


# ------------------------------------------------------------------ permissions
@pytest.mark.parametrize("url", ["/api/books/", "/api/authors/", "/api/sagas/", "/api/awards/", "/api/reviews/"])
def test_visitors_can_read(api_client, url):
    assert api_client.get(url).status_code == 200


@pytest.mark.parametrize(
    "url,payload",
    [
        ("/api/authors/", {"name": "X"}),
        ("/api/sagas/", {"name": "X"}),
        ("/api/awards/", {"name": "X"}),
    ],
)
def test_catalog_writes_require_admin(api_client, user_client, admin_client, url, payload):
    assert api_client.post(url, payload, format="json").status_code == 401
    assert user_client.post(url, payload, format="json").status_code == 403
    assert admin_client.post(url, payload, format="json").status_code == 201


def test_admin_crud_for_simple_catalog_entities(admin_client):
    created = admin_client.post(
        "/api/authors/",
        {"name": "Ursula K. Le Guin", "biography": "<i>Autora</i>", "birth_date": "1929-10-21", "country": "EE.UU."},
        format="json",
    )
    assert created.status_code == 201
    assert created.data["biography"] == "Autora"
    assert created.data["book_count"] == 0
    author_id = created.data["id"]

    assert admin_client.patch(f"/api/authors/{author_id}/", {"country": "USA"}, format="json").data["country"] == "USA"
    assert admin_client.get(f"/api/authors/{author_id}/").status_code == 200
    assert admin_client.get("/api/authors/?name=guin").data["count"] == 1
    assert admin_client.delete(f"/api/authors/{author_id}/").status_code == 204


def test_saga_and_award_expose_book_count(api_client, book, saga, award):
    assert api_client.get(f"/api/sagas/{saga.id}/").data["book_count"] == 1
    assert api_client.get(f"/api/awards/{award.id}/").data["book_count"] == 1


def test_deleting_author_with_books_returns_409(admin_client, book, author):
    response = admin_client.delete(f"/api/authors/{author.id}/")
    assert response.status_code == 409
    assert Author.objects.filter(pk=author.pk).exists()


def test_duplicate_names_are_rejected(admin_client, award):
    assert admin_client.post("/api/awards/", {"name": award.name}, format="json").status_code == 400


# ------------------------------------------------------------------ books
def test_book_detail_contains_full_information(api_client, book, user, other_user):
    Review.objects.create(user=user, book=book, title="Genial", content="x", rating=5)
    Review.objects.create(user=other_user, book=book, title="Bien", content="x", rating=4)
    UserBook.objects.create(owner=other_user, book=book)

    data = api_client.get(f"/api/books/{book.id}/").data
    assert data["title"] == "Dune"
    assert data["author"]["name"] == "Frank Herbert"
    assert data["saga"]["name"] == "Dune"
    assert [a["name"] for a in data["awards"]] == ["Premio Hugo"]
    assert data["average_rating"] == 4.5
    assert data["review_count"] == 2
    assert data["loan_availability"] == "available"
    assert data["available_copies"] == 1
    assert "9780441013593" in data["amazon_url"]
    assert "9780441013593" in data["casa_del_libro_url"]


def test_book_links_fall_back_to_title_and_author(admin_client, author):
    response = admin_client.post(
        "/api/books/", {"title": "Sin ISBN", "author_id": author.id}, format="json"
    )
    assert response.status_code == 201, response.content
    assert "Sin+ISBN+Frank+Herbert" in response.data["amazon_url"]
    assert response.data["average_rating"] is None
    assert response.data["loan_availability"] == "none"


def test_book_list_is_paginated_and_light(api_client, book):
    data = api_client.get("/api/books/").data
    assert data["count"] == 1
    assert "synopsis" not in data["results"][0]
    assert data["results"][0]["author"]["id"] == book.author_id


def test_admin_creates_updates_and_deletes_book(admin_client, author, saga, award):
    payload = {
        "title": "<b>Neuromancer</b>", "isbn": "978-0-441-56956-4", "publication_year": 1984, "language": "EN",
        "synopsis": "Cyberpunk", "author_id": author.id, "saga_id": saga.id, "award_ids": [award.id],
    }
    created = admin_client.post("/api/books/", payload, format="json")
    assert created.status_code == 201, created.content
    assert created.data["title"] == "Neuromancer"
    assert created.data["isbn"] == "9780441569564"
    assert created.data["language"] == "en"
    assert created.data["awards"][0]["name"] == "Premio Hugo"

    book_id = created.data["id"]
    updated = admin_client.patch(f"/api/books/{book_id}/", {"saga_id": None, "award_ids": []}, format="json")
    assert updated.status_code == 200
    assert updated.data["saga"] is None and updated.data["awards"] == []
    assert admin_client.delete(f"/api/books/{book_id}/").status_code == 204


@pytest.mark.parametrize(
    "overrides",
    [{"isbn": "123"}, {"publication_year": 3999}, {"publication_year": 5}, {"title": ""}],
)
def test_book_validation(admin_client, author, overrides):
    payload = {"title": "T", "author_id": author.id, **overrides}
    assert admin_client.post("/api/books/", payload, format="json").status_code == 400


def test_duplicate_isbn_rejected_but_own_isbn_kept_on_update(admin_client, book, author):
    duplicate = admin_client.post(
        "/api/books/", {"title": "Otro", "isbn": book.isbn, "author_id": author.id}, format="json"
    )
    assert duplicate.status_code == 400
    same = admin_client.patch(f"/api/books/{book.id}/", {"isbn": book.isbn}, format="json")
    assert same.status_code == 200


def test_regular_user_cannot_modify_books(user_client, book, author):
    assert user_client.post("/api/books/", {"title": "T", "author_id": author.id}, format="json").status_code == 403
    assert user_client.delete(f"/api/books/{book.id}/").status_code == 403


# ------------------------------------------------------------------ search & filters
@pytest.fixture
def library(book, other_user):
    a2 = Author.objects.create(name="Isaac Asimov")
    s2 = Saga.objects.create(name="Fundación")
    aw2 = Award.objects.create(name="Premio Nebula")
    b2 = Book.objects.create(title="Foundation", publication_year=1951, language="en", author=a2, saga=s2,
                             synopsis="Psicohistoria y caída de un imperio galáctico")
    b3 = Book.objects.create(title="Solaris", publication_year=1961, language="pl",
                             author=Author.objects.create(name="Stanisław Lem"))
    b3.awards.add(aw2)
    UserBook.objects.create(owner=other_user, book=b2, available_for_loan=True)
    return {"dune": book, "foundation": b2, "solaris": b3, "saga2": s2, "award2": aw2, "author2": a2}


def ids(response):
    return {item["id"] for item in response.data["results"]}


def test_filters(api_client, library):
    dune, foundation, solaris = library["dune"], library["foundation"], library["solaris"]
    assert ids(api_client.get("/api/books/?title=sola")) == {solaris.id}
    assert ids(api_client.get("/api/books/?author_name=asimov")) == {foundation.id}
    assert ids(api_client.get(f"/api/books/?author={library['author2'].id}")) == {foundation.id}
    assert ids(api_client.get("/api/books/?language=PL")) == {solaris.id}
    assert ids(api_client.get(f"/api/books/?saga={library['saga2'].id}")) == {foundation.id}
    assert ids(api_client.get(f"/api/books/?award={library['award2'].id}")) == {solaris.id}
    assert ids(api_client.get("/api/books/?year=1951")) == {foundation.id}
    assert ids(api_client.get("/api/books/?year_min=1960")) == {dune.id, solaris.id}
    assert ids(api_client.get("/api/books/?year_max=1960")) == {foundation.id}
    assert ids(api_client.get("/api/books/?available_for_loan=true")) == {foundation.id}
    assert ids(api_client.get("/api/books/?available_for_loan=false")) == {dune.id, solaris.id}


def test_fulltext_search(api_client, library):
    foundation, dune = library["foundation"], library["dune"]
    assert ids(api_client.get("/api/books/?q=asimov")) == {foundation.id}
    assert ids(api_client.get("/api/books/?q=psicohistoria imperio")) == {foundation.id}
    assert ids(api_client.get("/api/books/?q=9780441013593")) == {dune.id}
    assert ids(api_client.get("/api/books/?q=nonexistent")) == set()
    assert api_client.get("/api/books/?q=").data["count"] == 3


def test_ordering_and_has_reviews(api_client, library, user, other_user):
    Review.objects.create(user=user, book=library["foundation"], title="t", content="c", rating=5)
    Review.objects.create(user=user, book=library["dune"], title="t", content="c", rating=3)
    ordered = api_client.get("/api/books/?has_reviews=true&ordering=-average_rating").data["results"]
    assert [b["title"] for b in ordered] == ["Foundation", "Dune"]
    assert api_client.get("/api/books/?has_reviews=false").data["count"] == 1
    assert api_client.get("/api/books/?ordering=title").data["results"][0]["title"] == "Dune"
