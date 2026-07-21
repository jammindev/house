"""
Local development settings.
"""
from .base import *  # noqa: F403
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
    default=["http://localhost:5174",]
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
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="noreply@house.local")
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:5174")

# Anthropic API key — leave blank locally to disable LLM calls.
ANTHROPIC_API_KEY = env("ANTHROPIC_API_KEY", default="")

# LLM provider/model overrides — usually keep the base.py defaults.
LLM_PROVIDER = env("LLM_PROVIDER", default="anthropic")
LLM_TEXT_MODEL = env("LLM_TEXT_MODEL", default="claude-haiku-4-5-20251001")
LLM_VISION_MODEL = env("LLM_VISION_MODEL", default="claude-haiku-4-5-20251001")

# Embedding provider (parcours 21). Locally you can run Ollama (bge-m3) for free
# by setting EMBEDDING_PROVIDER=ollama; otherwise Voyage needs VOYAGE_API_KEY.
EMBEDDING_PROVIDER = env("EMBEDDING_PROVIDER", default="voyage")
EMBEDDING_MODEL = env("EMBEDDING_MODEL", default="voyage-3")
EMBEDDING_DIMENSIONS = env.int("EMBEDDING_DIMENSIONS", default=1024)
EMBEDDING_BASE_URL = env("EMBEDDING_BASE_URL", default="http://localhost:11434")
VOYAGE_API_KEY = env("VOYAGE_API_KEY", default="")
EMBEDDING_INDEXING_ENABLED = env.bool("EMBEDDING_INDEXING_ENABLED", default=False)
AGENT_HYBRID_RETRIEVAL_ENABLED = env.bool("AGENT_HYBRID_RETRIEVAL_ENABLED", default=False)

# Agent web search — requires the agent on Sonnet 4.6+ (dynamic filtering).
AGENT_WEB_SEARCH_ENABLED = env.bool("AGENT_WEB_SEARCH_ENABLED", default=False)

# Telegram bot channel — leave blank to disable (default).
TELEGRAM_BOT_TOKEN = env("TELEGRAM_BOT_TOKEN", default="")
TELEGRAM_BOT_USERNAME = env("TELEGRAM_BOT_USERNAME", default="")
TELEGRAM_WEBHOOK_SECRET = env("TELEGRAM_WEBHOOK_SECRET", default="")

# Django Vite Configuration (HMR for local development)
DJANGO_VITE = {
    "default": {
        "dev_mode": True,
        "dev_server_host": "localhost",
        "dev_server_port": env.int("VITE_DEV_SERVER_PORT", default=5174),
        "static_url_prefix": "react",
        "manifest_path": BASE_DIR / "static" / "react" / ".vite" / "manifest.json",  # noqa: F405
    }
}

ENABLE_API_SCHEMA = True
