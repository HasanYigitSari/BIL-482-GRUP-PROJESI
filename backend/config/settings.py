import os
from pathlib import Path
from urllib.parse import urlparse

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

LOCAL_DEVELOPMENT = os.environ.get("LOCAL_DEVELOPMENT", "false").lower() == "true"
DEBUG = LOCAL_DEVELOPMENT
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "")
if len(SECRET_KEY) < 50 or SECRET_KEY.startswith("replace-"):
    raise ImproperlyConfigured("Set DJANGO_SECRET_KEY to a random value of at least 50 characters.")

ALLOWED_HOSTS = ["localhost", "127.0.0.1", "[::1]"] if LOCAL_DEVELOPMENT else [
    host.strip() for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "").split(",") if host.strip()
]
WEBAUTHN_RP_ID = os.environ.get("WEBAUTHN_RP_ID", "localhost" if LOCAL_DEVELOPMENT else "")
WEBAUTHN_ORIGIN = os.environ.get(
    "WEBAUTHN_ORIGIN", "http://localhost:5173" if LOCAL_DEVELOPMENT else ""
)
WEBAUTHN_RP_NAME = "Inventory Manager"
if not WEBAUTHN_RP_ID or not WEBAUTHN_ORIGIN:
    raise ImproperlyConfigured("Set WEBAUTHN_RP_ID and WEBAUTHN_ORIGIN.")
origin = urlparse(WEBAUTHN_ORIGIN)
if origin.path or origin.query or origin.fragment or origin.username or origin.password:
    raise ImproperlyConfigured("WEBAUTHN_ORIGIN must be an origin without a path or credentials.")
if not LOCAL_DEVELOPMENT and (origin.scheme != "https" or not ALLOWED_HOSTS):
    raise ImproperlyConfigured("HTTPS and explicit allowed hosts are required outside local development.")
if LOCAL_DEVELOPMENT and (WEBAUTHN_RP_ID != "localhost" or WEBAUTHN_ORIGIN != "http://localhost:5173"):
    raise ImproperlyConfigured("Local development uses RP localhost and origin http://localhost:5173.")

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "rest_framework",
    "api.apps.ApiConfig",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
ROOT_URLCONF = "config.urls"
ASGI_APPLICATION = "config.asgi.application"
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("DB_NAME", "inventory_manager"),
        "USER": os.environ.get("DB_USER", "inventory_manager"),
        "PASSWORD": os.environ.get("DB_PASSWORD", ""),
        "HOST": os.environ.get("DB_HOST", "127.0.0.1"),
        "PORT": os.environ.get("DB_PORT", "5433"),
        "OPTIONS": {"connect_timeout": 5},
    }
}
AUTH_USER_MODEL = "api.User"
AUTHENTICATION_BACKENDS = ["api.authentication.PasskeyBackend"]
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["api.authentication.BrowserSessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "EXCEPTION_HANDLER": "api.errors.exception_handler",
    "UNAUTHENTICATED_USER": "django.contrib.auth.models.AnonymousUser",
}

SESSION_ENGINE = "django.contrib.sessions.backends.db"
SESSION_COOKIE_NAME = "inventory_manager_session"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = not LOCAL_DEVELOPMENT
SESSION_COOKIE_AGE = 24 * 60 * 60
SESSION_SAVE_EVERY_REQUEST = False
CSRF_COOKIE_NAME = "inventory_manager_csrf"
CSRF_COOKIE_HTTPONLY = True  # The frontend obtains a masked token from the CSRF endpoint.
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = not LOCAL_DEVELOPMENT
CSRF_TRUSTED_ORIGINS = [WEBAUTHN_ORIGIN]
SECURE_SSL_REDIRECT = not LOCAL_DEVELOPMENT
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
DATA_UPLOAD_MAX_MEMORY_SIZE = 64 * 1024
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_TZ = True

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "loggers": {
        "api.security": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "api.inventory": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}
