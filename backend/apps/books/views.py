from rest_framework import filters as drf_filters
from rest_framework import viewsets
from django_filters import rest_framework as filters

from apps.common.permissions import IsAdminOrReadOnly
from apps.common.views import RefreshAfterWriteMixin

from .filters import BookFilter
from .models import Book
from .serializers import BookListSerializer, BookSerializer


class BookViewSet(RefreshAfterWriteMixin, viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    filterset_class = BookFilter
    filter_backends = [filters.DjangoFilterBackend, drf_filters.OrderingFilter]
    ordering_fields = ["title", "publication_year", "created_at", "average_rating", "review_count"]

    def get_queryset(self):
        queryset = Book.objects.select_related("author", "saga").with_stats()
        if self.action != "list":
            queryset = queryset.prefetch_related("awards")
        return queryset

    def get_serializer_class(self):
        return BookListSerializer if self.action == "list" else BookSerializer
