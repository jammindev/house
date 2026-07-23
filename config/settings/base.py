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
    "water",
    "weather",
    "projects",
    "insurance",
    "tasks",
    "trackers",
    "photos",
    "app_settings",
    "notifications",
    "alerts",
    "agent",
    "ai_usage",
    "telegram",
    "releases",
    "chickens",
    "pings",
    "budget",
    "shopping",
    "briefings",
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
        "agent_burst": "10/min",
        "agent_sustained": "100/hour",
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

# LLM provider configuration. The agent and OCR layers go through the
# `apps.agent.llm.get_llm_client()` factory keyed on `LLM_PROVIDER`.
# Adding `OllamaClient` later means setting `LLM_PROVIDER=ollama` — no refactor
# needed in the agent or document apps.
LLM_PROVIDER = "anthropic"
LLM_TEXT_MODEL = "claude-haiku-4-5-20251001"
LLM_VISION_MODEL = "claude-haiku-4-5-20251001"
LLM_REQUEST_TIMEOUT_SECONDS = 30
# Vision OCR (full-page images) is slower than chat round-trips.
LLM_VISION_TIMEOUT_SECONDS = 60

# Embedding provider (hybrid semantic retrieval, parcours 21). Anthropic has no
# embeddings API, so vectors come from a separate provider behind
# `apps.agent.embeddings.get_embedding_client()`, keyed on `EMBEDDING_PROVIDER`.
# Prod default: Voyage AI (hosted, 0 GB RAM on the VPS). Ollama local (bge-m3) is
# the target once the machine has >= 8 GB RAM — flip EMBEDDING_PROVIDER=ollama,
# no refactor. See docs/fiches/EMBEDDINGS.md.
EMBEDDING_PROVIDER = "voyage"
EMBEDDING_MODEL = "voyage-3"
EMBEDDING_DIMENSIONS = 1024
EMBEDDING_REQUEST_TIMEOUT_SECONDS = 30
# Ollama endpoint, only used when EMBEDDING_PROVIDER=ollama.
EMBEDDING_BASE_URL = "http://localhost:11434"
# Voyage API key — empty by default; set per environment / in .env.
VOYAGE_API_KEY = ""
# Write-time indexing: when True, post_save/post_delete of a searchable entity
# (re)builds its EmbeddingChunk rows synchronously (best-effort). Off by default
# so tests and provider-less setups incur no side effect; enable via env once
# VOYAGE_API_KEY is set (aligns with activating hybrid retrieval, parcours 21).
# The backfill command indexes regardless of this flag.
EMBEDDING_INDEXING_ENABLED = False

# Hybrid retrieval (parcours 21 lot 3): when True, `retrieval.search()` adds a
# semantic (pgvector k-NN) leg alongside full-text and fuses both with Reciprocal
# Rank Fusion. Off by default → byte-identical to pure full-text. Turn on only
# once the index is populated (VOYAGE_API_KEY set + `backfill_embeddings` run).
AGENT_HYBRID_RETRIEVAL_ENABLED = False
# RRF damping constant (rank fusion). 60 is the standard default.
RRF_K = 60

# Agent tool-use loop: max LLM round-trips per question. Each iteration is one
# LLM call; the tools are dropped on the last pass to force a final answer.
# Bounds latency and cost of the function-calling loop. 4 leaves room to chain
# search_household -> get_entity -> answer in a single turn.
AGENT_MAX_TOOL_ITERATIONS = 4

# Agent conversation retention: conversations untouched for longer than this are
# eligible for cleanup by `manage.py cleanup_agent_conversations`. 0 disables it.
AGENT_CONVERSATION_RETENTION_DAYS = 365

# Agent web search (Anthropic server-side `web_search` tool). Off by default: it
# calls the public web (cost + external content) and its dynamic result filtering
# requires the agent to run on Sonnet 4.6+ (set LLM_TEXT_MODEL accordingly).
# When ON, the model may search the web for current/external facts it can't
# answer from household data or stable general knowledge. `MAX_USES` caps the
# number of searches per question (0 = no cap).
AGENT_WEB_SEARCH_ENABLED = False
AGENT_WEB_SEARCH_MAX_USES = 5

# Proactive daily digest (parcours 19). The digest reuses the pings scheduler +
# Telegram delivery; these tune its content and optional polish.
# - ELEC_ANOMALY_THRESHOLD: relative increase (last 30d vs previous 30d) above
#   which the electricity section fires (0.30 = +30%).
# - AI_POLISH_ENABLED: when on (and an API key is set), the digest text is
#   rewritten by the LLM into a warm paragraph; any failure falls back to the
#   deterministic template. Off by default (cost + keeps the send deterministic).
DIGEST_ELEC_ANOMALY_THRESHOLD = 0.30
DIGEST_AI_POLISH_ENABLED = False

# Budgets (parcours 21): ratio at which a monthly budget flips to the "attention"
# state (below the 100% overrun). 0.8 = warn once 80% of the ceiling is spent.
BUDGET_WARNING_RATIO = 0.8

# Telegram bot channel for the agent. Empty token = channel disabled: the
# webhook rejects everything and no outbound call is ever made.
# Overridden per environment in local.py / production.py.
TELEGRAM_BOT_TOKEN = ""
TELEGRAM_BOT_USERNAME = ""  # public @username of the bot, for t.me deep-links
TELEGRAM_WEBHOOK_SECRET = ""
TELEGRAM_LINK_TOKEN_MAX_AGE_SECONDS = 15 * 60
# Per-chat cooldown between agent questions — a burst of messages costs one
# LLM call, the rest get a "slow down" reply.
TELEGRAM_COOLDOWN_SECONDS = 5
