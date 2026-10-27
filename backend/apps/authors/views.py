from django.db.models import Count
from django_filters import rest_framework as filters
from rest_framework import filters as drf_filters
from rest_framework import serializers, viewsets
from rest_framework.validators import UniqueValidator

from apps.common.permissions import IsAdminOrReadOnly
from apps.common.sanitizers import SanitizedCharField
from apps.common.views import RefreshAfterWriteMixin

from .models import Author


class AuthorSerializer(serializers.ModelSerializer):
    name = SanitizedCharField(
        max_length=200, validators=[UniqueValidator(queryset=Author.objects.all(), lookup="iexact")]
    )
    biography = SanitizedCharField(required=False, allow_blank=True, max_length=20000)
    country = SanitizedCharField(required=False, allow_blank=True, max_length=100)
    book_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Author
        fields = ("id", "name", "biography", "birth_date", "country", "book_count", "created_at")
        read_only_fields = ("id", "book_count", "created_at")


class AuthorFilter(filters.FilterSet):
    name = filters.CharFilter(lookup_expr="icontains")
    country = filters.CharFilter(lookup_expr="iexact")

    class Meta:
        model = Author
        fields = ["name", "country"]


class AuthorViewSet(RefreshAfterWriteMixin, viewsets.ModelViewSet):
    serializer_class = AuthorSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_class = AuthorFilter
    filter_backends = [filters.DjangoFilterBackend, drf_filters.SearchFilter, drf_filters.OrderingFilter]
    search_fields = ["name", "biography"]
    ordering_fields = ["name", "created_at", "book_count"]
    ordering = ["name"]

    def get_queryset(self):
        return Author.objects.annotate(book_count=Count("books", distinct=True))
