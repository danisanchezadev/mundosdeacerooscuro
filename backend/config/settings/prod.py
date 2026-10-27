from .base import *  # noqa: F401,F403
from .base import env

DEBUG = False

if SECRET_KEY.startswith("insecure-dev-key"):  # noqa: F405
    raise RuntimeError("DJANGO_SECRET_KEY must be set in production.")

SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
ACCOUNT_DEFAULT_HTTP_PROTOCOL = "https"
