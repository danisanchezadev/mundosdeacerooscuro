import pytest
import responses
from django.core.management import call_command

from apps.authors.models import Author
from apps.books.models import Book
from apps.scraping import catalog
from apps.scraping.clients import (
    OpenLibraryClient,
    WikipediaClient,
    parse_birth_date,
    pick_isbn,
)
from apps.scraping.importer import CatalogImporter

pytestmark = pytest.mark.django_db

SEARCH_URL = "https://openlibrary.org/search.json"
WIKI_URL = "https://en.wikipedia.org/w/api.php"
WIKI_ES_URL = "https://es.wikipedia.org/w/api.php"


def ol_search_doc(**overrides):
    doc = {
        "key": "/works/OL1W", "title": "Dune", "author_name": ["Frank Herbert"], "author_key": ["OL2A"],
        "first_publish_year": 1965, "isbn": ["0441013597", "9780441013593"], "language": ["eng", "spa"], "cover_i": 123,
    }
    doc.update(overrides)
    return {"docs": [doc]}


def wiki_page(text, title="Dune (novel)"):
    return {"query": {"pages": {"1": {"title": title, "index": 1, "extract": text}}}}


def wiki_pages(*pages):
    return {"query": {"pages": {str(i): {"title": t, "index": i, "extract": x} for i, (t, x) in enumerate(pages, 1)}}}


def test_curated_catalog_has_enough_unique_books():
    keys = {(b.title.lower(), b.author.lower()) for b in catalog.CURATED_BOOKS}
    assert len(catalog.CURATED_BOOKS) >= 100
    assert len(keys) == len(catalog.CURATED_BOOKS)
    for book in catalog.CURATED_BOOKS:
        assert all(key in catalog.AWARDS for key in book.awards)
        assert book.saga is None or book.saga in catalog.SAGA_DESCRIPTIONS


def test_helpers():
    assert pick_isbn(["0441013597", "978-0-441-01359-3"]) == "9780441013593"
    assert pick_isbn(["0441013597"]) == "0441013597"
    assert pick_isbn(["abc"]) is None
    assert str(parse_birth_date("8 October 1920")) == "1920-10-08"
    assert str(parse_birth_date("October 8, 1920")) == "1920-10-08"
    assert parse_birth_date("1920") is None
    assert parse_birth_date(None) is None


@responses.activate
def test_openlibrary_client_parses_results():
    responses.get(SEARCH_URL, json=ol_search_doc())
    responses.get("https://openlibrary.org/works/OL1W.json", json={"description": {"value": "Sinopsis OL"}})
    responses.get("https://openlibrary.org/authors/OL2A.json", json={"bio": "Bio", "birth_date": "8 October 1920"})

    client = OpenLibraryClient(delay=0)
    found = client.find_book("Dune", "Frank Herbert")
    assert found.isbn == "9780441013593"
    assert found.cover_url.endswith("/b/id/123-L.jpg")
    assert found.languages == ["en", "es"]
    assert client.work_description("/works/OL1W") == "Sinopsis OL"
    assert client.work_description(None) == ""
    details = client.author_details("OL2A")
    assert details.bio == "Bio" and str(details.birth_date) == "1920-10-08"
    assert client.author_details(None).bio == ""


@responses.activate
def test_openlibrary_client_handles_errors_and_no_results():
    responses.get(SEARCH_URL, json={"docs": []})
    client = OpenLibraryClient(delay=0)
    assert client.find_book("X", "Y") is None
    responses.replace(responses.GET, SEARCH_URL, status=404)
    assert client.find_book("X", "Y") is None


@responses.activate
def test_openlibrary_cover_falls_back_to_isbn():
    responses.get(SEARCH_URL, json=ol_search_doc(cover_i=None))
    found = OpenLibraryClient(delay=0).find_book("Dune", "Frank Herbert")
    assert "/b/isbn/9780441013593-L.jpg" in found.cover_url


@responses.activate
def test_wikipedia_validates_page_and_falls_back_between_languages():
    responses.get(WIKI_ES_URL, json=wiki_page("Texto sobre otra cosa distinta."))
    responses.get(WIKI_URL, json=wiki_pages(("Dune (novel)", "Dune is a 1965 novel by Frank Herbert."), ("Frank Herbert", "Frank Herbert was a writer.")))
    client = WikipediaClient(languages=("es", "en"), delay=0)
    assert client.book_synopsis("Dune", "Frank Herbert").startswith("Dune is a 1965")
    assert client.author_biography("Frank Herbert").startswith("Frank Herbert was")

    responses.replace(responses.GET, WIKI_URL, json=wiki_page("Nothing relevant here"))
    assert client.book_synopsis("Dune", "Frank Herbert") == ""


@responses.activate
def test_wikipedia_rejects_pages_whose_title_does_not_match():
    # The author's article must not be used as a book synopsis (and vice versa).
    responses.get(WIKI_URL, json=wiki_page("Frank Herbert fue un escritor famoso por Dune.", title="Frank Herbert"))
    client = WikipediaClient(languages=("en",), delay=0)
    assert client.book_synopsis("Dune", "Frank Herbert") == ""
    assert client.author_biography("Frank Herbert").startswith("Frank Herbert fue")


@responses.activate
def test_wikipedia_prefers_exact_title_over_sequels():
    responses.get(
        WIKI_URL,
        json=wiki_pages(
            ("Chapterhouse: Dune", "Chapterhouse: Dune is a 1985 novel by Frank Herbert."),
            ("Dune (novel)", "Dune is a 1965 science fiction novel by Frank Herbert."),
        ),
    )
    text = WikipediaClient(languages=("en",), delay=0).book_synopsis("Dune", "Frank Herbert")
    assert text.startswith("Dune is a 1965")


@responses.activate
def test_wikipedia_truncates_long_text():
    responses.get(WIKI_URL, json=wiki_page("Herbert " + "palabra " * 1000))
    text = WikipediaClient(languages=("en",), delay=0).book_synopsis("Dune", "Frank Herbert", max_chars=100)
    assert len(text) <= 100


@responses.activate
def test_importer_is_idempotent_and_never_overwrites_edits():
    responses.get(SEARCH_URL, json=ol_search_doc())
    responses.get("https://openlibrary.org/works/OL1W.json", json={"description": "Desc OL"})
    responses.get("https://openlibrary.org/authors/OL2A.json", json={"bio": "Bio OL", "birth_date": "8 October 1920"})
    responses.get(WIKI_URL, json=wiki_page("Frank Herbert escribió Dune."))

    def build():
        return CatalogImporter(OpenLibraryClient(delay=0), WikipediaClient(languages=("en",), delay=0))

    stats = build().run(limit=1)
    assert (stats.created, stats.updated, stats.failed) == (1, 0, 0)

    book = Book.objects.get(title="Dune")
    assert book.isbn == "9780441013593" and book.publication_year == 1965 and book.language == "en"
    assert book.synopsis.startswith("Frank Herbert") and book.external_cover_url
    assert book.saga.name == "Dune"
    assert set(book.awards.values_list("name", flat=True)) == {"Premio Hugo", "Premio Nebula"}
    author = Author.objects.get(name="Frank Herbert")
    assert author.country == "Estados Unidos" and str(author.birth_date) == "1920-10-08"

    book.synopsis = "Editada por un admin"
    book.save()
    stats = build().run(limit=1)
    assert (stats.created, stats.updated) == (0, 1)
    assert Book.objects.count() == 1
    assert Book.objects.get().synopsis == "Editada por un admin"


@responses.activate
def test_importer_survives_unreachable_sources():
    responses.get(SEARCH_URL, status=500)
    responses.get(WIKI_URL, status=500)
    importer = CatalogImporter(
        OpenLibraryClient(delay=0), WikipediaClient(languages=("en",), delay=0)
    )
    stats = importer.run(limit=2)
    assert stats.created == 2 and stats.failed == 0
    assert Book.objects.count() == 2
    assert Book.objects.first().external_cover_url == ""


@responses.activate
def test_importer_without_wikipedia_uses_openlibrary_description():
    responses.get(SEARCH_URL, json=ol_search_doc())
    responses.get("https://openlibrary.org/works/OL1W.json", json={"description": "Desc OL"})
    responses.get("https://openlibrary.org/authors/OL2A.json", json={})
    CatalogImporter(OpenLibraryClient(delay=0), None).run(limit=1)
    assert Book.objects.get().synopsis == "Desc OL"


@responses.activate
def test_importer_reports_failures_without_aborting(monkeypatch):
    responses.get(SEARCH_URL, json={"docs": []})
    importer = CatalogImporter(OpenLibraryClient(delay=0), None)
    original = importer.import_book
    calls = {"n": 0}

    def flaky(entry):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("boom")
        return original(entry)

    monkeypatch.setattr(importer, "import_book", flaky)
    stats = importer.run(limit=3)
    assert stats.failed == 1 and stats.created == 2 and "boom" in stats.errors[0]


@responses.activate
def test_discover_completes_with_subject_works():
    responses.get(SEARCH_URL, json={"docs": []})
    works = [
        {"title": "Dune", "authors": [{"name": "Frank Herbert"}], "first_publish_year": 1965},
        {"title": "Book Z", "authors": [{"name": "Zed Author"}], "first_publish_year": 1999},
        {"title": "No Author", "authors": []},
    ]
    responses.get("https://openlibrary.org/subjects/science_fiction.json", json={"works": works})
    responses.get("https://openlibrary.org/subjects/science_fiction.json", json={"works": []})
    importer = CatalogImporter(OpenLibraryClient(delay=0), None)
    stats = importer.run(limit=len(catalog.CURATED_BOOKS) + 1, discover=True)
    assert Book.objects.filter(title="Book Z", author__name="Zed Author").exists()
    assert stats.created == len(catalog.CURATED_BOOKS) + 1


@responses.activate
def test_management_command(capsys):
    responses.get(SEARCH_URL, json=ol_search_doc())
    responses.get("https://openlibrary.org/works/OL1W.json", json={})
    responses.get("https://openlibrary.org/authors/OL2A.json", json={})
    call_command("seed_scifi_catalog", limit=1, no_wikipedia=True, delay=0)
    assert Book.objects.count() == 1
    assert "1 creados" in capsys.readouterr().out


def test_management_command_log_survives_legacy_console_encoding():
    import io

    from apps.scraping.management.commands.seed_scifi_catalog import Command

    raw = io.BytesIO()
    console = io.TextIOWrapper(raw, encoding="cp1252", errors="strict")
    command = Command(stdout=console)
    command._log("[1/1] + Solaris — Stanisław Lem")
    console.flush()
    assert b"Stanis?aw Lem" in raw.getvalue()


def test_management_command_rejects_invalid_limit():
    from django.core.management.base import CommandError

    with pytest.raises(CommandError):
        call_command("seed_scifi_catalog", limit=0)
