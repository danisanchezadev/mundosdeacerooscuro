from django.db.models import Exists, OuterRef, Q
from django_filters import rest_framework as filters
from rest_framework import filters as drf_filters
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.permissions import IsAdmin, IsOwnerOrAdminOrReadOnly, is_admin

from . import services
from .models import ACTIVE_STATUSES, Loan, Reservation, UserBook
from .serializers import (
    LoanAdminUpdateSerializer,
    LoanCreateSerializer,
    LoanSerializer,
    ReservationSerializer,
    UserBookSerializer,
)


# ------------------------------------------------------------------ user books (copies)
class UserBookFilter(filters.FilterSet):
    mine = filters.BooleanFilter(method="filter_mine")
    on_loan = filters.BooleanFilter(field_name="on_loan")

    class Meta:
        model = UserBook
        fields = ["book", "owner", "available_for_loan"]

    def filter_mine(self, queryset, name, value):
        if not value:
            return queryset
        user = self.request.user
        return queryset.filter(owner=user) if user.is_authenticated else queryset.none()


class UserBookViewSet(viewsets.ModelViewSet):
    serializer_class = UserBookSerializer
    permission_classes = [IsOwnerOrAdminOrReadOnly]
    owner_field = "owner"
    filterset_class = UserBookFilter
    filter_backends = [filters.DjangoFilterBackend, drf_filters.OrderingFilter]
    ordering_fields = ["created_at"]

    def get_queryset(self):
        active_loans = Loan.objects.filter(user_book=OuterRef("pk"), status__in=ACTIVE_STATUSES)
        return (
            UserBook.objects.select_related("owner", "book", "book__author")
            .annotate(on_loan=Exists(active_loans))
        )

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_destroy(self, instance):
        if instance.loans.exists():
            raise ValidationError(
                "Este ejemplar tiene préstamos asociados. Márcalo como no disponible en lugar de eliminarlo."
            )
        instance.delete()


# ------------------------------------------------------------------ loans
class LoanFilter(filters.FilterSet):
    role = filters.ChoiceFilter(choices=[("owner", "owner"), ("borrower", "borrower")], method="filter_role")
    book = filters.NumberFilter(field_name="user_book__book_id")

    class Meta:
        model = Loan
        fields = ["status", "user_book", "owner", "borrower"]

    def filter_role(self, queryset, name, value):
        user = self.request.user
        return queryset.filter(owner=user) if value == "owner" else queryset.filter(borrower=user)


class LoanViewSet(viewsets.ModelViewSet):
    filterset_class = LoanFilter
    filter_backends = [filters.DjangoFilterBackend, drf_filters.OrderingFilter]
    ordering_fields = ["requested_at", "status"]
    ordering = ["-requested_at", "-id"]

    def get_permissions(self):
        if self.action in ("update", "partial_update", "destroy"):
            return [IsAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = Loan.objects.select_related("owner", "borrower", "user_book__book")
        user = self.request.user
        return queryset if is_admin(user) else queryset.filter(Q(owner=user) | Q(borrower=user))

    def get_serializer_class(self):
        if self.action == "create":
            return LoanCreateSerializer
        if self.action in ("update", "partial_update"):
            return LoanAdminUpdateSerializer
        return LoanSerializer

    def create(self, request, *args, **kwargs):
        serializer = LoanCreateSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        loan = serializer.save()
        return Response(self._render(loan), status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        loan = self.get_object()
        serializer = LoanAdminUpdateSerializer(loan, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(self._render(loan))

    def _render(self, loan):
        return LoanSerializer(loan, context=self.get_serializer_context()).data

    def _transition(self, request, service):
        loan = service(self.get_object(), request.user)
        return Response(self._render(loan))

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        return self._transition(request, services.approve_loan)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        return self._transition(request, services.cancel_loan)

    @action(detail=True, methods=["post"], url_path="mark-borrowed")
    def mark_borrowed(self, request, pk=None):
        return self._transition(request, services.mark_borrowed)

    @action(detail=True, methods=["post"], url_path="confirm-return")
    def confirm_return(self, request, pk=None):
        return self._transition(request, services.confirm_return)

    @action(detail=True, methods=["post"], url_path="mark-lost")
    def mark_lost(self, request, pk=None):
        return self._transition(request, services.mark_lost)


# ------------------------------------------------------------------ reservations
class ReservationFilter(filters.FilterSet):
    class Meta:
        model = Reservation
        fields = ["book", "active", "user"]


class ReservationViewSet(viewsets.ModelViewSet):
    serializer_class = ReservationSerializer
    permission_classes = [IsAuthenticated]
    filterset_class = ReservationFilter
    filter_backends = [filters.DjangoFilterBackend, drf_filters.OrderingFilter]
    ordering_fields = ["queue_position", "created_at"]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        queryset = Reservation.objects.select_related("user", "book")
        user = self.request.user
        return queryset if is_admin(user) else queryset.filter(user=user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reservation = serializer.save()
        return Response(self.get_serializer(reservation).data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        services.cancel_reservation(instance)
