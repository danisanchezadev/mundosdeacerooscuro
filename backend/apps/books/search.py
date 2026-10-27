"""Full-text search for books.

On PostgreSQL the search uses native full-text search (`SearchVector` /
`SearchQuery` / `SearchRank`) with weights: title (A), author (B), ISBN (B),
synopsis (C). On any other backend (SQLite in development) it falls back to a
case-insensitive multi-term `icontains` match over the same fields, so the
public behaviour is identical and the future migration needs no code changes.
"""
from django.db import connection
from django.db.models import Q, QuerySet

SEARCH_CONFIG = "simple"


def fulltext_search(queryset: QuerySet, query: str) -> QuerySet:
    query = (query or "").strip()
    if not query:
        return queryset

    if connection.vendor == "postgresql":
        from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector

        vector = (
            SearchVector("title", weight="A", config=SEARCH_CONFIG)
            + SearchVector("author__name", weight="B", config=SEARCH_CONFIG)
            + SearchVector("isbn", weight="B", config=SEARCH_CONFIG)
            + SearchVector("synopsis", weight="C", config=SEARCH_CONFIG)
        )
        search_query = SearchQuery(query, search_type="websearch", config=SEARCH_CONFIG)
        return (
            queryset.annotate(search_rank=SearchRank(vector, search_query))
            .filter(search_rank__gt=0)
            .order_by("-search_rank", "-created_at")
        )

    for term in query.split():
        queryset = queryset.filter(
            Q(title__icontains=term)
            | Q(author__name__icontains=term)
            | Q(isbn__icontains=term)
            | Q(synopsis__icontains=term)
        )
    return queryset
