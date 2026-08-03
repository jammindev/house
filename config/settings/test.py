# config/settings/test.py
"""
Test settings - optimized for fast test execution.
"""
from .base import *  # noqa: F403
import environ

env = environ.Env(USE_SQLITE_TEST_DB=(bool, False))
environ.Env.read_env(BASE_DIR / ".env.local")  # noqa: F405

# Default to PostgreSQL for test compatibility (ArrayField support).
# Set USE_SQLITE_TEST_DB=true to force SQLite for constrained environments.
if env.bool("USE_SQLITE_TEST_DB", default=False):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }
else:
    postgres_db = env.db(default="postgres://house_user:house_password@localhost:5432/house")
    postgres_db.setdefault(
        "TEST",
        {
            "NAME": env("TEST_DATABASE_NAME", default=postgres_db.get("NAME", "house")),
        },
    )
    DATABASES = {
        "default": postgres_db,
    }

# Test secret key
SECRET_KEY = "test-secret-key-not-for-production"

# Debug mode for tests
DEBUG = True

# Allowed hosts for tests
ALLOWED_HOSTS = ["*"]

# Security settings (disabled for tests)
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
SECURE_SSL_REDIRECT = False
SECURE_HSTS_SECONDS = 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
SECURE_PROXY_SSL_HEADER = None

# Email backend for tests
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# La suite tourne sur une instance **configurée** : les endpoints de l'agent
# refusent désormais en 503 nommé quand la capacité `assistant` manque
# (parcours 28, lot 3), et sans cette clé chaque test de vue mesurerait ce refus
# au lieu du comportement qu'il vient vérifier.
#
# La valeur est volontairement inutilisable : aucun test n'appelle le
# fournisseur pour de vrai — ils passent tous un client de test à `service.ask`
# ou remplacent la fonction. Un test qui atteindrait le réseau échouerait
# bruyamment sur l'authentification, jamais en silence.
#
# L'absence de clé reste testée, explicitement, là où c'est le sujet :
# `app_settings/tests/test_capabilities.py` et
# `agent/tests/test_service.py::test_missing_api_key_returns_idk_...`.
ANTHROPIC_API_KEY = "sk-ant-test-not-a-real-key"

# Password hashers (faster for tests)
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

# Disable logging during tests
LOGGING_CONFIG = None

# Login URLs
LOGIN_URL = "login"
LOGIN_REDIRECT_URL = "dashboard"
LOGOUT_REDIRECT_URL = "login"

# Django Vite in test mode (avoid manifest requirement during template rendering)
DJANGO_VITE = {
    "default": {
        "dev_mode": True,
        "dev_server_host": "localhost",
        "dev_server_port": 5174,
        "static_url_prefix": "react",
        "manifest_path": BASE_DIR / "static" / "react" / ".vite" / "manifest.json",  # noqa: F405
    }
}

ENABLE_API_SCHEMA = False
