from urllib.parse import quote_plus

from django.apps import apps
from django.conf import settings
from django.db import models
from django.db.models import Avg, Count, IntegerField, OuterRef, Subquery
from django.db.models.functions import Coalesce


def _count_by_book(queryset) -> Coalesce:
    sub = queryset.order_by().values("book").annotate(c=Count("pk")).values("c")[:1]
    return Coalesce(Subquery(sub, output_field=IntegerField()), 0)


class BookQuerySet(models.QuerySet):
    def with_stats(self):
        """Annotate rating, review count, loan availability and reservation queue size.

        Subqueries are used (instead of joins) so that aggregates never multiply each other.
        """
        Review = apps.get_model("reviews", "Review")
        UserBook = apps.get_model("loans", "UserBook")
        Reservation = apps.get_model("loans", "Reservation")

        ratings = Review.objects.filter(book=OuterRef("pk")).order_by().values("book")
        return self.annotate(
            average_rating=Subquery(
                ratings.annotate(a=Avg("rating")).values("a")[:1], output_field=models.FloatField()
            ),
            review_count=_count_by_book(Review.objects.filter(book=OuterRef("pk"))),
            offered_copies=_count_by_book(
                UserBook.objects.filter(book=OuterRef("pk"), available_for_loan=True)
            ),
            available_copies=_count_by_book(UserBook.objects.free().filter(book=OuterRef("pk"))),
            reservation_count=_count_by_book(Reservation.objects.filter(book=OuterRef("pk"), active=True)),
        )


class Book(models.Model):
    title = models.CharField(max_length=300, db_index=True)
    isbn = models.CharField(max_length=20, unique=True, null=True, blank=True)
    publication_year = models.PositiveSmallIntegerField(null=True, blank=True, db_index=True)
    language = models.CharField(max_length=10, blank=True, db_index=True)
    synopsis = models.TextField(blank=True)
    external_cover_url = models.URLField(max_length=500, blank=True)

    author = models.ForeignKey("authors.Author", on_delete=models.PROTECT, related_name="books")
    saga = models.ForeignKey(
        "sagas.Saga", on_delete=models.SET_NULL, null=True, blank=True, related_name="books"
    )
    awards = models.ManyToManyField("awards.Award", blank=True, related_name="books")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = BookQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["author", "publication_year"])]

    def __str__(self):
        return f"{self.title} ({self.author})"

    def _search_term(self) -> str:
        return quote_plus(self.isbn or f"{self.title} {self.author.name}")

    @property
    def amazon_url(self) -> str:
        return f"{settings.AMAZON_SEARCH_URL}{self._search_term()}"

    @property
    def casa_del_libro_url(self) -> str:
        return f"{settings.CASA_DEL_LIBRO_SEARCH_URL}{self._search_term()}"
