from django.db.models import Count
from django_filters import rest_framework as filters
from rest_framework import filters as drf_filters
from rest_framework import serializers, viewsets

from apps.common.permissions import IsOwnerOrAdminOrReadOnly
from apps.common.sanitizers import SanitizedCharField
from apps.users.serializers import PublicUserSerializer

from .models import Review, ReviewComment


class ReviewSerializer(serializers.ModelSerializer):
    user = PublicUserSerializer(read_only=True)
    title = SanitizedCharField(max_length=200)
    content = SanitizedCharField(max_length=10000)
    rating = serializers.IntegerField(min_value=1, max_value=5)
    book_title = serializers.CharField(source="book.title", read_only=True)
    comment_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Review
        fields = (
            "id", "user", "book", "book_title", "title", "content", "rating",
            "comment_count", "created_at", "updated_at",
        )
        read_only_fields = ("id", "user", "book_title", "comment_count", "created_at", "updated_at")

    def validate(self, attrs):
        if self.instance is not None and "book" in attrs and attrs["book"] != self.instance.book:
            raise serializers.ValidationError({"book": "No se puede cambiar el libro de una reseña."})
        return attrs


class ReviewCommentSerializer(serializers.ModelSerializer):
    user = PublicUserSerializer(read_only=True)
    content = SanitizedCharField(max_length=3000)

    class Meta:
        model = ReviewComment
        fields = ("id", "review", "user", "content", "created_at")
        read_only_fields = ("id", "user", "created_at")

    def validate(self, attrs):
        if self.instance is not None and "review" in attrs and attrs["review"] != self.instance.review:
            raise serializers.ValidationError({"review": "No se puede mover un comentario a otra reseña."})
        return attrs


class ReviewFilter(filters.FilterSet):
    class Meta:
        model = Review
        fields = ["book", "user", "rating"]


class ReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewSerializer
    permission_classes = [IsOwnerOrAdminOrReadOnly]
    filterset_class = ReviewFilter
    filter_backends = [filters.DjangoFilterBackend, drf_filters.OrderingFilter]
    ordering_fields = ["created_at", "rating"]
    ordering = ["-created_at", "-id"]

    def get_queryset(self):
        return Review.objects.select_related("user", "book").annotate(comment_count=Count("comments"))

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ReviewCommentFilter(filters.FilterSet):
    class Meta:
        model = ReviewComment
        fields = ["review", "user"]


class ReviewCommentViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewCommentSerializer
    permission_classes = [IsOwnerOrAdminOrReadOnly]
    filterset_class = ReviewCommentFilter
    filter_backends = [filters.DjangoFilterBackend, drf_filters.OrderingFilter]
    ordering_fields = ["created_at"]
    ordering = ["created_at", "id"]

    def get_queryset(self):
        return ReviewComment.objects.select_related("user")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
