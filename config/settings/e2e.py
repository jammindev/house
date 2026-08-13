"""
E2E test settings — base de données isolée, assets statiques pré-buildés.
Utilisé exclusivement par Playwright via webServer.
"""
from .base import *  # noqa: F403
import environ

env = environ.Env(DEBUG=(bool, True))
environ.Env.read_env(BASE_DIR / ".env.e2e")  # noqa: F405

SECRET_KEY = env("SECRET_KEY")

DEBUG = True

ALLOWED_HOSTS = ["127.0.0.1", "localhost"]

CSRF_TRUSTED_ORIGINS = ["http://127.0.0.1:8002", "http://localhost:8002"]

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept', 'accept-encoding', 'authorization', 'content-type',
    'dnt', 'origin', 'user-agent', 'x-csrftoken', 'x-requested-with',
]
CORS_ALLOW_METHODS = ['DELETE', 'GET', 'OPTIONS', 'PATCH', 'POST', 'PUT']

# Base de données E2E — complètement séparée de la DB dev
DATABASES = {
    "default": env.db(default="postgres://house_user:house_password@localhost:5432/house_e2e"),
}

# Capacités optionnelles — déclarées par l'environnement, pas figées ici.
#
# `base.py` pose `ANTHROPIC_API_KEY = ""`, donc l'instance E2E se comporte par
# défaut comme une instance non configurée : l'assistant y affiche « non
# configuré », ce qui est le bon comportement et ce que testent les E2E.
#
# Le harnais de captures (`playwright.screenshots.config.ts`) a besoin de
# l'inverse — montrer l'assistant tel qu'il est quand il l'est. Il pose donc la
# variable, avec une valeur inutilisable : la capacité ne teste que la
# **présence** de la clé, et la capture relit une conversation semée sans jamais
# appeler le fournisseur.
ANTHROPIC_API_KEY = env("ANTHROPIC_API_KEY", default="")

SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
SECURE_SSL_REDIRECT = False
SECURE_HSTS_SECONDS = 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
SECURE_PROXY_SSL_HEADER = None

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# Hashage rapide — les tests E2E ne testent pas la sécurité du hashing
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

# Vite : servir les assets pré-buildés (npm run build requis avant les tests)
DJANGO_VITE = {
    "default": {
        "dev_mode": False,
        "static_url_prefix": "react",
        "manifest_path": BASE_DIR / "static" / "react" / ".vite" / "manifest.json",  # noqa: F405
    }
}

ENABLE_API_SCHEMA = False
