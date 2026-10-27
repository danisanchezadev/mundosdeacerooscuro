from django.db.models import Count
from django_filters import rest_framework as filters
from rest_framework import filters as drf_filters
from rest_framework import serializers, viewsets
from rest_framework.validators import UniqueValidator

from apps.common.permissions import IsAdminOrReadOnly
from apps.common.sanitizers import SanitizedCharField
from apps.common.views import RefreshAfterWriteMixin

from .models import Saga


class SagaSerializer(serializers.ModelSerializer):
    name = SanitizedCharField(
        max_length=200, validators=[UniqueValidator(queryset=Saga.objects.all(), lookup="iexact")]
    )
    description = SanitizedCharField(required=False, allow_blank=True, max_length=10000)
    book_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Saga
        fields = ("id", "name", "description", "book_count")
        read_only_fields = ("id", "book_count")


class SagaViewSet(RefreshAfterWriteMixin, viewsets.ModelViewSet):
    serializer_class = SagaSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [filters.DjangoFilterBackend, drf_filters.SearchFilter, drf_filters.OrderingFilter]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "book_count"]
    ordering = ["name"]

    def get_queryset(self):
        return Saga.objects.annotate(book_count=Count("books", distinct=True))
