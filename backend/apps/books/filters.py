from django_filters import rest_framework as filters

from .models import Book
from .search import fulltext_search


class BookFilter(filters.FilterSet):
    q = filters.CharFilter(method="filter_q", help_text="Búsqueda full text (título, autor, ISBN, sinopsis).")
    title = filters.CharFilter(lookup_expr="icontains")
    author = filters.NumberFilter(field_name="author_id")
    author_name = filters.CharFilter(field_name="author__name", lookup_expr="icontains")
    language = filters.CharFilter(lookup_expr="iexact")
    saga = filters.NumberFilter(field_name="saga_id")
    award = filters.NumberFilter(field_name="awards__id")
    year = filters.NumberFilter(field_name="publication_year")
    year_min = filters.NumberFilter(field_name="publication_year", lookup_expr="gte")
    year_max = filters.NumberFilter(field_name="publication_year", lookup_expr="lte")
    available_for_loan = filters.BooleanFilter(method="filter_available")
    has_reviews = filters.BooleanFilter(method="filter_has_reviews")

    class Meta:
        model = Book
        fields = []

    def filter_q(self, queryset, name, value):
        return fulltext_search(queryset, value)

    def filter_available(self, queryset, name, value):
        if value is None:
            return queryset
        return queryset.filter(available_copies__gt=0) if value else queryset.filter(available_copies=0)

    def filter_has_reviews(self, queryset, name, value):
        if value is None:
            return queryset
        return queryset.filter(review_count__gt=0) if value else queryset.filter(review_count=0)
