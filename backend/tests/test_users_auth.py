import pytest
from django.core import mail

from tests.conftest import PASSWORD

pytestmark = pytest.mark.django_db


def test_register_returns_jwt_and_creates_user(api_client, django_user_model):
    response = api_client.post(
        "/api/auth/registration/",
        {"email": "New@Example.com", "name": "<b>Neo</b>", "password1": PASSWORD, "password2": PASSWORD},
        format="json",
    )
    assert response.status_code == 201, response.content
    assert response.data["access"] and response.data["refresh"]
    created = django_user_model.objects.get(email="new@example.com")
    assert created.name == "Neo"
    assert not created.is_staff


def test_register_rejects_weak_or_mismatched_passwords(api_client):
    weak = api_client.post(
        "/api/auth/registration/", {"email": "a@b.com", "password1": "123", "password2": "123"}, format="json"
    )
    mismatch = api_client.post(
        "/api/auth/registration/",
        {"email": "a@b.com", "password1": PASSWORD, "password2": PASSWORD + "x"},
        format="json",
    )
    assert weak.status_code == 400
    assert mismatch.status_code == 400


def test_login_refresh_and_me(api_client, user):
    login = api_client.post("/api/auth/login/", {"email": user.email, "password": PASSWORD}, format="json")
    assert login.status_code == 200, login.content
    access, refresh = login.data["access"], login.data["refresh"]

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    me = api_client.get("/api/users/me/")
    assert me.status_code == 200
    assert me.data["email"] == user.email
    assert me.data["completed_loans"] == 0
    assert me.data["role"] == "user"

    api_client.credentials()
    refreshed = api_client.post("/api/auth/token/refresh/", {"refresh": refresh}, format="json")
    assert refreshed.status_code == 200
    assert refreshed.data["access"]


def test_login_wrong_password(api_client, user):
    response = api_client.post("/api/auth/login/", {"email": user.email, "password": "nope"}, format="json")
    assert response.status_code == 400


def test_me_requires_authentication(api_client):
    assert api_client.get("/api/users/me/").status_code == 401


def test_update_profile_sanitizes_name(user_client, user):
    response = user_client.patch(
        "/api/users/me/",
        {"name": "<script>alert(1)</script>Trinity", "avatar_url": "https://img.example.com/a.png"},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["name"] == "Trinity"
    bad = user_client.patch("/api/users/me/", {"avatar_url": "javascript:alert(1)"}, format="json")
    assert bad.status_code == 400


def test_me_cannot_escalate_privileges(user_client, user):
    user_client.patch("/api/users/me/", {"is_staff": True, "email": "x@y.com"}, format="json")
    user.refresh_from_db()
    assert not user.is_staff
    assert user.email != "x@y.com"


def test_admin_user_management(admin_client, admin, user):
    listing = admin_client.get("/api/users/")
    assert listing.status_code == 200
    assert listing.data["count"] == 2

    patched = admin_client.patch(f"/api/users/{user.id}/", {"is_active": False}, format="json")
    assert patched.status_code == 200
    user.refresh_from_db()
    assert user.is_active is False

    self_demote = admin_client.patch(f"/api/users/{admin.id}/", {"is_staff": False}, format="json")
    assert self_demote.status_code == 400
    self_delete = admin_client.delete(f"/api/users/{admin.id}/")
    assert self_delete.status_code == 400
    assert admin_client.delete(f"/api/users/{user.id}/").status_code == 204


def test_users_endpoint_forbidden_for_regular_users(user_client, api_client):
    assert user_client.get("/api/users/").status_code == 403
    assert api_client.get("/api/users/").status_code == 401


def test_password_reset_sends_email(api_client, user):
    response = api_client.post("/api/auth/password/reset/", {"email": user.email}, format="json")
    assert response.status_code == 200
    assert len(mail.outbox) == 1
    assert "http://localhost:5173/reset-password/" in mail.outbox[0].body


def test_google_login_requires_credentials(api_client):
    response = api_client.post("/api/auth/google/", {}, format="json")
    assert response.status_code == 400


def test_user_model_helpers(user, admin):
    assert user.display_name == user.name
    assert user.role == "user" and admin.role == "admin"
    assert str(user) == user.email
    assert user.get_short_name() == user.name
    nameless = type(user).objects.create_user(email="anon@example.com", password=PASSWORD)
    assert nameless.display_name == "anon"
    with pytest.raises(ValueError):
        type(user).objects.create_user(email="", password=PASSWORD)
    superuser = type(user).objects.create_superuser(email="root@example.com", password=PASSWORD)
    assert superuser.is_staff and superuser.is_superuser
