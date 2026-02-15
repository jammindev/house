"""
Local development settings.
"""
from .base import *  # noqa: F403
from .base import _parse_duration, timedelta
import environ

env = environ.Env(DEBUG=(bool, True))
environ.Env.read_env(BASE_DIR / ".env.local")  # noqa: F405

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env("SECRET_KEY")  # Must be set in .env file

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["127.0.0.1", "localhost"])

CSRF_TRUSTED_ORIGINS = env.list(
    "CSRF_TRUSTED_ORIGINS",
    default=["http://localhost:5173",]
)

# CORS Configuration for local development
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]
CORS_ALLOW_METHODS = ['DELETE', 'GET', 'OPTIONS', 'PATCH', 'POST', 'PUT']

# Database
DATABASES = {
    "default": env.db(default=f"postgres://house_user:house_password@localhost:5432/house"),
}

# JWT Configuration
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": _parse_duration(
        env("JWT_ACCESS_LIFETIME", default="15 minutes"),
        timedelta(minutes=15),  # noqa: F405
    ),
    "REFRESH_TOKEN_LIFETIME": _parse_duration(
        env("JWT_REFRESH_LIFETIME", default="7 days"),
        timedelta(days=7),  # noqa: F405
    ),
    "ROTATE_REFRESH_TOKENS": env.bool("JWT_ROTATE_REFRESH_TOKENS", default=True),
    "BLACKLIST_AFTER_ROTATION": env.bool("JWT_BLACKLIST_AFTER_ROTATION", default=True),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# Security settings (disabled for local development)
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
SECURE_SSL_REDIRECT = False
SECURE_HSTS_SECONDS = 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
SECURE_PROXY_SSL_HEADER = None

# Email
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Django Vite Configuration (HMR for local development)
DJANGO_VITE = {
    "default": {
        "dev_mode": True,
        "dev_server_host": "localhost",
        "dev_server_port": 5173,
        "static_url_prefix": "react",
        "manifest_path": BASE_DIR / "static" / "react" / ".vite" / "manifest.json",  # noqa: F405
    }
}
