"""Idempotent import of the seed catalog into the database."""
import logging
from dataclasses import dataclass, field

from django.db import transaction

from apps.authors.models import Author
from apps.awards.models import Award
from apps.books.models import Book
from apps.sagas.models import Saga

from .catalog import AUTHOR_COUNTRIES, AWARDS, CURATED_BOOKS, SAGA_DESCRIPTIONS, SeedBook
from .clients import OpenLibraryClient, WikipediaClient

logger = logging.getLogger(__name__)

MAX_SYNOPSIS = 4000


@dataclass
class ImportStats:
    created: int = 0
    updated: int = 0
    skipped: int = 0
    failed: int = 0
    errors: list[str] = field(default_factory=list)


class CatalogImporter:
    def __init__(
        self,
        openlibrary: OpenLibraryClient,
        wikipedia: WikipediaClient | None = None,
        log=lambda message: None,
    ):
        self.openlibrary = openlibrary
        self.wikipedia = wikipedia
        self.log = log
        self._author_cache: dict[str, Author] = {}

    # -------------------------------------------------------------- orchestration
    def run(self, limit: int = 100, discover: bool = False) -> ImportStats:
        entries = list(CURATED_BOOKS[:limit])
        if discover and len(entries) < limit:
            entries += self._discover(limit - len(entries), {(e.title.lower(), e.author.lower()) for e in entries})

        stats = ImportStats()
        for index, entry in enumerate(entries, start=1):
            try:
                with transaction.atomic():
                    created = self.import_book(entry)
                stats.created += int(created)
                stats.updated += int(not created)
                self.log(f"[{index}/{len(entries)}] {'+' if created else '='} {entry.title} — {entry.author}")
            except Exception as exc:  # one bad record must never abort the whole seed
                logger.exception("Failed importing %s", entry.title)
                stats.failed += 1
                stats.errors.append(f"{entry.title}: {exc}")
                self.log(f"[{index}/{len(entries)}] ! {entry.title}: {exc}")
        return stats

    def _discover(self, missing: int, known: set[tuple[str, str]]) -> list[SeedBook]:
        found: list[SeedBook] = []
        offset = 0
        while len(found) < missing and offset < 500:
            works = self.openlibrary.subject_works("science_fiction", limit=50, offset=offset)
            if not works:
                break
            for work in works:
                authors = work.get("authors") or []
                title = (work.get("title") or "").strip()
                if not title or not authors:
                    continue
                name = authors[0].get("name", "").strip()
                if not name or (title.lower(), name.lower()) in known:
                    continue
                known.add((title.lower(), name.lower()))
                found.append(SeedBook(title, name, work.get("first_publish_year") or 0, "en"))
                if len(found) >= missing:
                    break
            offset += 50
        return found

    # -------------------------------------------------------------- single book
    def import_book(self, entry: SeedBook) -> bool:
        """Create or enrich a book. Returns True when a new row was created."""
        meta = self.openlibrary.find_book(entry.title, entry.author)
        author = self._get_author(entry.author, meta.author_key if meta else None)
        saga = self._get_saga(entry.saga)
        awards = [self._get_award(key) for key in entry.awards]

        synopsis = ""
        if self.wikipedia:
            synopsis = self.wikipedia.book_synopsis(entry.title, entry.author)
        if not synopsis and meta:
            synopsis = self.openlibrary.work_description(meta.work_key)
        synopsis = synopsis[:MAX_SYNOPSIS]

        isbn = meta.isbn if meta else None
        if isbn and Book.objects.filter(isbn=isbn).exclude(title__iexact=entry.title).exists():
            isbn = None
        year = entry.year or (meta.year if meta else None)

        book = (
            Book.objects.filter(isbn=isbn).first() if isbn else None
        ) or Book.objects.filter(title__iexact=entry.title, author=author).first()
        created = book is None
        if created:
            book = Book(title=entry.title, author=author)

        # Never overwrite data that an administrator may have edited.
        book.publication_year = book.publication_year or year or None
        book.language = book.language or entry.language
        book.isbn = book.isbn or isbn
        book.synopsis = book.synopsis or synopsis
        book.external_cover_url = book.external_cover_url or (meta.cover_url if meta else "")
        book.saga = book.saga or saga
        book.save()
        if awards:
            book.awards.add(*awards)
        return created

    # -------------------------------------------------------------- related objects
    def _get_author(self, name: str, author_key: str | None) -> Author:
        if name in self._author_cache:
            return self._author_cache[name]
        author, created = Author.objects.get_or_create(
            name=name, defaults={"country": AUTHOR_COUNTRIES.get(name, "")}
        )
        if created or not author.biography or not author.birth_date:
            details = self.openlibrary.author_details(author_key)
            biography = (self.wikipedia.author_biography(name) if self.wikipedia else "") or details.bio
            author.biography = author.biography or biography[:MAX_SYNOPSIS]
            author.birth_date = author.birth_date or details.birth_date
            author.country = author.country or AUTHOR_COUNTRIES.get(name, "")
            author.save()
        self._author_cache[name] = author
        return author

    @staticmethod
    def _get_saga(name: str | None) -> Saga | None:
        if not name:
            return None
        saga, _ = Saga.objects.get_or_create(name=name, defaults={"description": SAGA_DESCRIPTIONS.get(name, "")})
        return saga

    @staticmethod
    def _get_award(key: str) -> Award:
        name, description = AWARDS[key]
        award, _ = Award.objects.get_or_create(name=name, defaults={"description": description})
        return award
