import re
from datetime import date

from rest_framework import serializers

from apps.authors.models import Author
from apps.awards.models import Award
from apps.common.sanitizers import SanitizedCharField
from apps.sagas.models import Saga

from .models import Book

ISBN_RE = re.compile(r"^(\d{9}[\dX]|\d{13})$")


class AuthorRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Author
        fields = ("id", "name")


class SagaRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Saga
        fields = ("id", "name")


class AwardRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Award
        fields = ("id", "name")


class BookStatsMixin(serializers.Serializer):
    average_rating = serializers.SerializerMethodField()
    review_count = serializers.IntegerField(read_only=True)
    available_copies = serializers.IntegerField(read_only=True)
    offered_copies = serializers.IntegerField(read_only=True)
    reservation_count = serializers.IntegerField(read_only=True)
    loan_availability = serializers.SerializerMethodField(
        help_text="available | lent | none"
    )

    def get_average_rating(self, obj) -> float | None:
        value = getattr(obj, "average_rating", None)
        return round(value, 2) if value is not None else None

    def get_loan_availability(self, obj) -> str:
        if getattr(obj, "available_copies", 0) > 0:
            return "available"
        return "lent" if getattr(obj, "offered_copies", 0) > 0 else "none"


class BookListSerializer(BookStatsMixin, serializers.ModelSerializer):
    author = AuthorRefSerializer(read_only=True)
    saga = SagaRefSerializer(read_only=True)

    class Meta:
        model = Book
        fields = (
            "id", "title", "author", "saga", "publication_year", "language", "external_cover_url",
            "average_rating", "review_count", "available_copies", "offered_copies",
            "reservation_count", "loan_availability", "created_at",
        )
        read_only_fields = fields


class BookSerializer(BookStatsMixin, serializers.ModelSerializer):
    title = SanitizedCharField(max_length=300)
    synopsis = SanitizedCharField(required=False, allow_blank=True, max_length=20000)
    language = serializers.CharField(required=False, allow_blank=True, max_length=10)
    isbn = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=20)
    publication_year = serializers.IntegerField(required=False, allow_null=True, min_value=1000)

    author = AuthorRefSerializer(read_only=True)
    author_id = serializers.PrimaryKeyRelatedField(
        source="author", queryset=Author.objects.all(), write_only=True
    )
    saga = SagaRefSerializer(read_only=True)
    saga_id = serializers.PrimaryKeyRelatedField(
        source="saga", queryset=Saga.objects.all(), write_only=True, required=False, allow_null=True
    )
    awards = AwardRefSerializer(many=True, read_only=True)
    award_ids = serializers.PrimaryKeyRelatedField(
        source="awards", queryset=Award.objects.all(), many=True, write_only=True, required=False
    )
    amazon_url = serializers.CharField(read_only=True)
    casa_del_libro_url = serializers.CharField(read_only=True)

    class Meta:
        model = Book
        fields = (
            "id", "title", "isbn", "publication_year", "language", "synopsis", "external_cover_url",
            "author", "author_id", "saga", "saga_id", "awards", "award_ids",
            "average_rating", "review_count", "available_copies", "offered_copies",
            "reservation_count", "loan_availability", "amazon_url", "casa_del_libro_url",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_isbn(self, value):
        if not value:
            return None
        normalized = re.sub(r"[\s-]", "", value).upper()
        if not ISBN_RE.match(normalized):
            raise serializers.ValidationError("El ISBN debe tener 10 o 13 dígitos.")
        duplicates = Book.objects.filter(isbn=normalized)
        if self.instance is not None:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError("Ya existe un libro con este ISBN.")
        return normalized

    def validate_publication_year(self, value):
        if value is not None and value > date.today().year + 1:
            raise serializers.ValidationError("El año de publicación no puede estar en el futuro.")
        return value

    def validate_language(self, value):
        return value.strip().lower()
