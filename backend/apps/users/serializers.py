from allauth.account.utils import user_pk_to_url_str
from dj_rest_auth.registration.serializers import RegisterSerializer as BaseRegisterSerializer
from dj_rest_auth.serializers import PasswordResetSerializer as BasePasswordResetSerializer
from django.apps import apps
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.common.sanitizers import SanitizedCharField, sanitize_text

User = get_user_model()


def count_completed_loans(user) -> int:
    Loan = apps.get_model("loans", "Loan")
    return Loan.objects.completed_for(user).count()


class PublicUserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="display_name", read_only=True)

    class Meta:
        model = User
        fields = ("id", "name", "avatar_url")
        read_only_fields = fields


class UserSerializer(serializers.ModelSerializer):
    name = SanitizedCharField(max_length=150, required=False, allow_blank=True)
    completed_loans = serializers.SerializerMethodField()
    role = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ("id", "email", "name", "avatar_url", "role", "completed_loans", "date_joined")
        read_only_fields = ("id", "email", "role", "completed_loans", "date_joined")

    def get_completed_loans(self, obj) -> int:
        annotated = getattr(obj, "completed_loans_count", None)
        return annotated if annotated is not None else count_completed_loans(obj)

    def validate_avatar_url(self, value):
        if value and not value.lower().startswith(("https://", "http://")):
            raise serializers.ValidationError("La URL del avatar debe ser http(s).")
        return value


class AdminUserSerializer(UserSerializer):
    class Meta(UserSerializer.Meta):
        fields = UserSerializer.Meta.fields + ("is_active", "is_staff")
        read_only_fields = ("id", "email", "role", "completed_loans", "date_joined")


def frontend_reset_url(request, user, temp_key) -> str:
    """Password reset links point to the SPA, which then calls the confirm endpoint."""
    return f"{settings.FRONTEND_URL.rstrip('/')}/reset-password/{user_pk_to_url_str(user)}/{temp_key}"


class PasswordResetSerializer(BasePasswordResetSerializer):
    def get_email_options(self):
        return {"url_generator": frontend_reset_url}


class RegisterSerializer(BaseRegisterSerializer):
    username = None
    name = SanitizedCharField(max_length=150, required=False, allow_blank=True)

    def get_cleaned_data(self):
        data = super().get_cleaned_data()
        data.pop("username", None)
        data["name"] = sanitize_text(self.validated_data.get("name", ""))
        return data
