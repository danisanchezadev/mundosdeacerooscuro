from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView
from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from django_filters import rest_framework as filters
from rest_framework import filters as drf_filters
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.permissions import IsAdmin

from .serializers import AdminUserSerializer, UserSerializer

User = get_user_model()


class GoogleLogin(SocialLoginView):
    """Exchange a Google OAuth2 access token for a platform JWT pair."""

    adapter_class = GoogleOAuth2Adapter
    client_class = OAuth2Client
    callback_url = "postmessage"


class UserFilter(filters.FilterSet):
    class Meta:
        model = User
        fields = ["is_active", "is_staff"]


class UserViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Administrator user management plus the authenticated `me` profile endpoint."""

    queryset = User.objects.all()
    filterset_class = UserFilter
    filter_backends = [filters.DjangoFilterBackend, drf_filters.SearchFilter, drf_filters.OrderingFilter]
    search_fields = ["email", "name"]
    ordering_fields = ["date_joined", "email", "name"]

    def get_permissions(self):
        if self.action == "me":
            return [IsAuthenticated()]
        return [IsAdmin()]

    def get_serializer_class(self):
        return UserSerializer if self.action == "me" else AdminUserSerializer

    def get_queryset(self):
        return User.objects.annotate(
            completed_loans_count=Count(
                "owned_loans", filter=Q(owned_loans__status="RETURN_CONFIRMED"), distinct=True
            )
            + Count(
                "borrowed_loans", filter=Q(borrowed_loans__status="RETURN_CONFIRMED"), distinct=True
            )
        ).order_by("-date_joined")

    @action(detail=False, methods=["get", "patch"])
    def me(self, request):
        serializer = self.get_serializer(
            request.user, data=request.data, partial=True
        ) if request.method == "PATCH" else self.get_serializer(request.user)
        if request.method == "PATCH":
            serializer.is_valid(raise_exception=True)
            serializer.save()
        return Response(serializer.data)

    def perform_update(self, serializer):
        user = serializer.instance
        if user == self.request.user and (
            serializer.validated_data.get("is_active") is False
            or serializer.validated_data.get("is_staff") is False
        ):
            raise ValidationError("No puedes retirarte a ti mismo el acceso o el rol de administrador.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance == self.request.user:
            raise ValidationError("No puedes eliminar tu propia cuenta desde el panel de administración.")
        instance.delete()
