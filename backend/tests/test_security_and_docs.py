import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from apps.common.sanitizers import sanitize_text

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("<b>hola</b>", "hola"),
        ("<script>alert(1)</script>texto", "texto"),
        ("<<b>script>alert(1)<</b>/script>", "alert(1)"),
        ("<img src=x onerror=alert(1)//", "img src=x onerror=alert(1)//"),
        ('<a href="javascript:alert(1)">click</a>', "click"),
        ("a < b y c > d", "a < b y c > d"),
        ("  espacios  ", "espacios"),
        ("nul\x00byte", "nulbyte"),
        ("", ""),
        (None, ""),
    ],
)
def test_sanitize_text(raw, expected):
    assert sanitize_text(raw) == expected


def test_openapi_schema_and_docs_are_served(api_client):
    schema = api_client.get("/api/schema/")
    assert schema.status_code == 200
    assert api_client.get("/api/docs/").status_code == 200
    assert api_client.get("/api/redoc/").status_code == 200
    body = schema.content.decode()
    for path in ("/api/books/", "/api/loans/{id}/confirm-return/", "/api/reservations/", "/api/auth/google/"):
        assert path in body


def test_api_root_and_unknown_route(api_client):
    assert api_client.get("/api/").status_code == 200
    assert api_client.get("/api/nope/").status_code == 404


def test_rate_limiting_blocks_excess_requests(api_client, settings):
    from django.core.cache import cache
    from rest_framework.throttling import AnonRateThrottle

    cache.clear()
    monkey_rates = dict(AnonRateThrottle.THROTTLE_RATES, anon="3/min")
    AnonRateThrottle.THROTTLE_RATES = monkey_rates
    try:
        statuses = [api_client.get("/api/authors/").status_code for _ in range(5)]
    finally:
        AnonRateThrottle.THROTTLE_RATES = dict(monkey_rates, anon="100000/min")
        cache.clear()
    assert statuses[:3] == [200, 200, 200]
    assert statuses[-1] == 429


def test_write_throttle_applies_only_to_unsafe_methods(admin_client, settings):
    from django.core.cache import cache
    from rest_framework.throttling import UserRateThrottle

    from apps.common.throttles import WriteRateThrottle

    cache.clear()
    WriteRateThrottle.THROTTLE_RATES = dict(WriteRateThrottle.THROTTLE_RATES, write="2/min")
    try:
        post = [admin_client.post("/api/awards/", {"name": f"A{i}"}, format="json").status_code for i in range(4)]
        reads = [admin_client.get("/api/awards/").status_code for _ in range(4)]
    finally:
        WriteRateThrottle.THROTTLE_RATES = dict(WriteRateThrottle.THROTTLE_RATES, write="100000/min")
        cache.clear()
    assert post[:2] == [201, 201] and post[-1] == 429
    assert set(reads) == {200}


def test_csrf_is_not_required_for_jwt_but_enforced_for_session_admin():
    client = APIClient(enforce_csrf_checks=True)
    response = client.post("/api/auth/login/", {"email": "a@b.c", "password": "x"}, format="json")
    assert response.status_code == 400  # reaches the view: stateless JWT API is not CSRF-exposed
    assert APIClient(enforce_csrf_checks=True).post("/admin/login/", {}).status_code == 403
