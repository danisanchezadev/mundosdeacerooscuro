from rest_framework import serializers

from apps.books.models import Book
from apps.common.sanitizers import SanitizedCharField
from apps.users.serializers import PublicUserSerializer

from . import services
from .models import Loan, LoanStatus, Reservation, UserBook


class UserBookSerializer(serializers.ModelSerializer):
    owner = PublicUserSerializer(read_only=True)
    book = serializers.PrimaryKeyRelatedField(queryset=Book.objects.all())
    book_title = serializers.CharField(source="book.title", read_only=True)
    book_author = serializers.CharField(source="book.author.name", read_only=True)
    book_cover = serializers.CharField(source="book.external_cover_url", read_only=True)
    notes = SanitizedCharField(required=False, allow_blank=True, max_length=2000)
    on_loan = serializers.BooleanField(read_only=True)

    class Meta:
        model = UserBook
        fields = (
            "id", "owner", "book", "book_title", "book_author", "book_cover",
            "available_for_loan", "notes", "on_loan", "created_at",
        )
        read_only_fields = ("id", "owner", "on_loan", "created_at")

    def validate_book(self, value):
        if self.instance is not None and value != self.instance.book:
            raise serializers.ValidationError("No se puede cambiar el libro de un ejemplar.")
        return value


class LoanSerializer(serializers.ModelSerializer):
    owner = PublicUserSerializer(read_only=True)
    borrower = PublicUserSerializer(read_only=True)
    book_id = serializers.IntegerField(source="user_book.book_id", read_only=True)
    book_title = serializers.CharField(source="user_book.book.title", read_only=True)
    book_cover = serializers.CharField(source="user_book.book.external_cover_url", read_only=True)
    allowed_actions = serializers.SerializerMethodField()

    class Meta:
        model = Loan
        fields = (
            "id", "owner", "borrower", "user_book", "book_id", "book_title", "book_cover", "status",
            "requested_at", "approved_at", "borrowed_at", "returned_at",
            "owner_confirmed_return", "borrower_confirmed_return", "allowed_actions",
        )
        read_only_fields = fields

    def get_allowed_actions(self, obj) -> list[str]:
        request = self.context.get("request")
        return services.allowed_actions(obj, getattr(request, "user", None))


class LoanCreateSerializer(serializers.Serializer):
    user_book = serializers.PrimaryKeyRelatedField(queryset=UserBook.objects.all())

    def create(self, validated_data):
        return services.request_loan(self.context["request"].user, validated_data["user_book"])


class LoanAdminUpdateSerializer(serializers.ModelSerializer):
    """Administrators can correct the status of a loan (moderation)."""

    status = serializers.ChoiceField(choices=LoanStatus.choices)

    class Meta:
        model = Loan
        fields = ("status",)


class ReservationSerializer(serializers.ModelSerializer):
    user = PublicUserSerializer(read_only=True)
    book = serializers.PrimaryKeyRelatedField(queryset=Book.objects.all())
    book_title = serializers.CharField(source="book.title", read_only=True)

    class Meta:
        model = Reservation
        fields = ("id", "user", "book", "book_title", "queue_position", "active", "created_at")
        read_only_fields = ("id", "user", "book_title", "queue_position", "active", "created_at")

    def create(self, validated_data):
        return services.create_reservation(self.context["request"].user, validated_data["book"])
