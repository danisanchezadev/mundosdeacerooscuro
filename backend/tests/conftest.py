import pytest
from rest_framework.test import APIClient

from apps.authors.models import Author
from apps.awards.models import Award
from apps.books.models import Book
from apps.loans.models import UserBook
from apps.sagas.models import Saga

PASSWORD = "Str0ng-Passw0rd!"


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def make_user(django_user_model):
    counter = {"n": 0}

    def _make(email=None, **extra):
        counter["n"] += 1
        email = email or f"user{counter['n']}@example.com"
        return django_user_model.objects.create_user(email=email, password=PASSWORD, name=f"User {counter['n']}", **extra)

    return _make


@pytest.fixture
def client_for():
    def _client(user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    return _client


@pytest.fixture
def user(make_user):
    return make_user()


@pytest.fixture
def other_user(make_user):
    return make_user()


@pytest.fixture
def admin(make_user):
    return make_user(is_staff=True)


@pytest.fixture
def user_client(user, client_for):
    return client_for(user)


@pytest.fixture
def admin_client(admin, client_for):
    return client_for(admin)


@pytest.fixture
def author(db):
    return Author.objects.create(name="Frank Herbert", country="Estados Unidos")


@pytest.fixture
def saga(db):
    return Saga.objects.create(name="Dune", description="Arrakis")


@pytest.fixture
def award(db):
    return Award.objects.create(name="Premio Hugo")


@pytest.fixture
def book(author, saga, award):
    book = Book.objects.create(
        title="Dune", isbn="9780441013593", publication_year=1965, language="en",
        synopsis="Una épica en el desierto.", author=author, saga=saga,
    )
    book.awards.add(award)
    return book


@pytest.fixture
def copy(book, other_user):
    return UserBook.objects.create(owner=other_user, book=book, available_for_loan=True)
