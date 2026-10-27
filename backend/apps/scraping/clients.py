"""HTTP clients for the external sources used to seed the catalog."""
import logging
import re
import time
from dataclasses import dataclass, field
from datetime import date, datetime

import requests
from django.conf import settings
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)

OPENLIBRARY_URL = "https://openlibrary.org"
OPENLIBRARY_COVERS_URL = "https://covers.openlibrary.org"

ISO_639_2_TO_1 = {
    "eng": "en", "spa": "es", "fre": "fr", "fra": "fr", "ger": "de", "deu": "de", "ita": "it",
    "por": "pt", "rus": "ru", "pol": "pl", "chi": "zh", "zho": "zh", "jpn": "ja", "cat": "ca",
}


def build_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({"User-Agent": settings.SCRAPING_USER_AGENT, "Accept": "application/json"})
    retry = Retry(
        total=3, backoff_factor=0.8, status_forcelist=(429, 500, 502, 503, 504), allowed_methods=("GET",)
    )
    session.mount("https://", HTTPAdapter(max_retries=retry))
    session.mount("http://", HTTPAdapter(max_retries=retry))
    return session


class BaseClient:
    def __init__(self, session: requests.Session | None = None, delay: float = 0.2):
        self.session = session or build_session()
        self.delay = delay

    def _get_json(self, url: str, params: dict | None = None) -> dict | None:
        try:
            response = self.session.get(url, params=params, timeout=settings.SCRAPING_TIMEOUT)
            response.raise_for_status()
            if self.delay:
                time.sleep(self.delay)
            return response.json()
        except (requests.RequestException, ValueError) as exc:
            logger.warning("Request failed for %s: %s", url, exc)
            return None


# ------------------------------------------------------------------ OpenLibrary
@dataclass
class OpenLibraryBook:
    work_key: str | None = None
    title: str = ""
    author_name: str = ""
    author_key: str | None = None
    year: int | None = None
    isbn: str | None = None
    cover_url: str = ""
    languages: list[str] = field(default_factory=list)


@dataclass
class OpenLibraryAuthor:
    bio: str = ""
    birth_date: date | None = None


def pick_isbn(isbns: list[str]) -> str | None:
    clean = [re.sub(r"[\s-]", "", i).upper() for i in isbns or []]
    thirteen = [i for i in clean if re.fullmatch(r"97[89]\d{10}", i)]
    if thirteen:
        return thirteen[0]
    ten = [i for i in clean if re.fullmatch(r"\d{9}[\dX]", i)]
    return ten[0] if ten else None


def parse_birth_date(raw: str | None) -> date | None:
    """Parse full dates only; a bare year would fabricate a month and day."""
    if not raw:
        return None
    for fmt in ("%d %B %Y", "%B %d, %Y", "%Y-%m-%d", "%d %b %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(raw.strip(), fmt).date()
        except ValueError:
            continue
    return None


def _text(value) -> str:
    if isinstance(value, dict):
        value = value.get("value", "")
    return (value or "").strip() if isinstance(value, str) else ""


class OpenLibraryClient(BaseClient):
    SEARCH_FIELDS = "key,title,author_name,author_key,first_publish_year,isbn,language,cover_i"

    def find_book(self, title: str, author: str) -> OpenLibraryBook | None:
        data = self._get_json(
            f"{OPENLIBRARY_URL}/search.json",
            {"title": title, "author": author, "limit": 5, "fields": self.SEARCH_FIELDS},
        )
        docs = (data or {}).get("docs") or []
        if not docs:
            return None
        doc = next((d for d in docs if d.get("title", "").lower() == title.lower()), docs[0])
        isbn = pick_isbn(doc.get("isbn", []))
        cover_url = ""
        if doc.get("cover_i"):
            cover_url = f"{OPENLIBRARY_COVERS_URL}/b/id/{doc['cover_i']}-L.jpg"
        elif isbn:
            cover_url = f"{OPENLIBRARY_COVERS_URL}/b/isbn/{isbn}-L.jpg"
        return OpenLibraryBook(
            work_key=doc.get("key"),
            title=doc.get("title", title),
            author_name=(doc.get("author_name") or [author])[0],
            author_key=(doc.get("author_key") or [None])[0],
            year=doc.get("first_publish_year"),
            isbn=isbn,
            cover_url=cover_url,
            languages=[ISO_639_2_TO_1.get(code, code) for code in doc.get("language", [])[:10]],
        )

    def work_description(self, work_key: str | None) -> str:
        if not work_key:
            return ""
        data = self._get_json(f"{OPENLIBRARY_URL}{work_key}.json")
        return _text((data or {}).get("description"))

    def author_details(self, author_key: str | None) -> OpenLibraryAuthor:
        if not author_key:
            return OpenLibraryAuthor()
        data = self._get_json(f"{OPENLIBRARY_URL}/authors/{author_key}.json") or {}
        return OpenLibraryAuthor(bio=_text(data.get("bio")), birth_date=parse_birth_date(data.get("birth_date")))

    def subject_works(self, subject: str, limit: int, offset: int = 0) -> list[dict]:
        data = self._get_json(
            f"{OPENLIBRARY_URL}/subjects/{subject}.json", {"limit": limit, "offset": offset}
        )
        return (data or {}).get("works") or []


# ------------------------------------------------------------------ Wikipedia
class WikipediaClient(BaseClient):
    def __init__(self, languages: tuple[str, ...] = ("es", "en"), **kwargs):
        super().__init__(**kwargs)
        self.languages = languages

    def _intros(self, lang: str, query: str) -> list[tuple[str, str]]:
        """Top search hits as (page title, intro text), best match first."""
        data = self._get_json(
            f"https://{lang}.wikipedia.org/w/api.php",
            {
                "action": "query", "format": "json", "generator": "search", "gsrsearch": query,
                "gsrlimit": 5, "prop": "extracts", "exintro": 1, "explaintext": 1, "exsentences": 6,
                "exlimit": "max",
            },
        )
        pages = ((data or {}).get("query") or {}).get("pages") or {}
        ordered = sorted(pages.values(), key=lambda page: page.get("index", 0))
        return [(page.get("title", ""), (page.get("extract") or "").strip()) for page in ordered]

    @staticmethod
    def _base_title(title: str) -> str:
        return re.sub(r"\s*\([^)]*\)\s*$", "", title).strip().casefold()

    def _search_validated(self, queries: dict[str, str], page_name: str, extract_token: str, max_chars: int) -> str:
        """Return the first intro of a page titled exactly `page_name` (ignoring a "(novel)" suffix)
        whose text mentions `extract_token`. Guards against wrong pages such as sequels or the author's article.
        """
        wanted = page_name.strip().casefold()
        for lang in self.languages:
            for page_title, extract in self._intros(lang, queries.get(lang, queries["default"])):
                if extract and self._base_title(page_title) == wanted and extract_token.lower() in extract.lower():
                    if len(extract) > max_chars:
                        extract = extract[:max_chars].rsplit(" ", 1)[0]
                    return extract
        return ""

    def book_synopsis(self, title: str, author: str, max_chars: int = 2000) -> str:
        last_name = author.split()[-1]
        queries = {
            "es": f"{title} {author} novela",
            "en": f"{title} {author} novel",
            "default": f"{title} {author}",
        }
        return self._search_validated(queries, title, last_name, max_chars)

    def author_biography(self, author: str, max_chars: int = 3000) -> str:
        last_name = author.split()[-1]
        queries = {"es": f"{author} escritor", "en": f"{author} writer", "default": author}
        return self._search_validated(queries, author, last_name, max_chars)
