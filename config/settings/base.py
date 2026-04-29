# config/settings/base.py
"""
Base settings for house backend.
"""
from pathlib import Path
import sys

import environ
from pillow_heif import register_heif_opener

register_heif_opener()

# Build paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
APPS_DIR = BASE_DIR / "apps"

if str(APPS_DIR) not in sys.path:
    sys.path.insert(0, str(APPS_DIR))

# Core settings
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Application definition
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django_vite",
    "rest_framework",
    "drf_spectacular",
    "corsheaders",
    "django_filters",
    # House apps
    "core",
    "accounts",
    "households",
    "zones",
    "documents",
    "interactions",
    "directory",
    "tags",
    "equipment",
    "stock",
    "electricity",
    "projects",
    "insurance",
    "tasks",
    "photos",
    "app_settings",
    "notifications",
    "alerts",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    # Langue : après AuthenticationMiddleware pour avoir accès à request.user
    "core.middleware.UserLocaleMiddleware",
    "core.middleware.ActiveHouseholdMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "core.context_processors.app_debug_admin_link",
                "core.context_processors.active_household_context",
            ],
        },
    },
]

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# Internationalization
LANGUAGE_CODE = "en"
LANGUAGES = [
    ("en", "English"),
    ("fr", "Français"),
    ("de", "Deutsch"),
    ("es", "Español"),
]
LOCALE_PATHS = [
    BASE_DIR / "locale",
]
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Login URLs
LOGIN_URL = "login"
LOGIN_REDIRECT_URL = "app_dashboard"
LOGOUT_REDIRECT_URL = "login"

# Static files
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [
    BASE_DIR / "static",  # Custom static files (compiled React components)
]
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# Media files (user-uploaded content, e.g. avatars)
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Custom user model
AUTH_USER_MODEL = "accounts.User"

# REST Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_RATES": {
        "login_ip": "20/min",
        "login_email": "5/min",
        "change_password": "5/hour",
        "password_reset": "3/hour",
    },
}

SPECTACULAR_SETTINGS = {
    "TITLE": "House API",
    "DESCRIPTION": "OpenAPI schema for House Django REST API.",
    "VERSION": "1.0.0",
}

ENABLE_API_SCHEMA = False

from datetime import timedelta

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5174",
]
CORS_ALLOW_CREDENTIALS = True

# URL of the frontend SPA — used to build links in transactional emails (password reset, etc.).
# Overridden per environment in local.py / production.py.
FRONTEND_URL = "http://localhost:5174"
DEFAULT_FROM_EMAIL = "noreply@house.local"

# Anthropic API key for the AI layer (Claude Vision OCR, agent, ...).
# Empty string by default — extraction degrades to a no-op when unset.
# Overridden per environment in local.py / production.py.
ANTHROPIC_API_KEY = ""
