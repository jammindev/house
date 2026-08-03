"""Réglages d'une instance auto-hébergée : la production, avec ses défauts remplis.

Ce module n'est **pas** un troisième jeu de réglages de sécurité. Il importe
``production`` et ne fait qu'une chose avant : donner une valeur par défaut à
tout ce que le déploiement de l'auteur exige explicitement — clé secrète, base,
hôtes, origines. Un inconnu lance ``docker compose up`` et n'édite aucun fichier ;
le durcissement qu'il obtient est **celui de la production**, mot pour mot, et
tout durcissement futur ajouté à ``production.py`` le suivra sans qu'on y pense.

Dupliquer les réglages plutôt que les importer aurait produit deux textes qui
divergent — et le jour où ils divergent, aucun des deux ne fait plus autorité.
``test_production_settings.py`` ne surveille qu'un fichier ; il faut que ce soit
celui que tout le monde utilise.

Un seul bouton, et il est facultatif
------------------------------------

``MAISONNEE_PUBLIC_URL`` — l'adresse publique de l'instance, si elle en a une :

- **absent** — boîte sur un réseau local, servie en clair sur ``:8000``. Les
  cookies ne sont pas marqués ``Secure`` (le navigateur les jetterait), HSTS est
  à zéro, et ``ALLOWED_HOSTS`` accepte n'importe quel nom.
- **``https://maisonnee.exemple.fr``** — l'instance est exposée. Cookies
  ``Secure``, HSTS d'un an, et ``ALLOWED_HOSTS`` réduit à **ce seul hôte**.

C'est le point important de ce fichier : **la liste d'hôtes se resserre au moment
exact où l'exposition s'élargit.** Un ``ALLOWED_HOSTS`` permissif sur un réseau
local est un choix raisonnable — la machine se joint par IP, par nom ``.local``,
par nom Tailscale, et aucun de ces noms n'est connu à l'avance ; le même réglage
sur une instance publique ne l'est pas. Laisser l'utilisateur deviner qu'il doit
resserrer, c'est garantir qu'il ne le fera pas.

Ce que le fichier ne fait pas
-----------------------------

Il ne redirige **pas** vers HTTPS (``SECURE_SSL_REDIRECT`` reste à ``False``,
alors que la production le laisse à ``True``). Le TLS d'une instance
auto-hébergée se termine dans le reverse proxy de l'hébergeur — Caddy, Traefik,
le routeur de la box — qui redirige déjà. Rediriger une deuxième fois depuis
Django est au mieux inutile, au pire une **boucle infinie** : un proxy qui omet
``X-Forwarded-Proto`` fait croire à Django que la requête est en clair, Django
renvoie vers ``https://``, le proxy repasse la requête sans le header, et le
navigateur tourne jusqu'à l'erreur. C'est le piège classique de
l'auto-hébergement, et il ne se manifeste que chez celui qui héberge.
"""
from __future__ import annotations

import os
import secrets
from pathlib import Path
from urllib.parse import urlsplit

import environ
from django.core.exceptions import ImproperlyConfigured

from .base import BASE_DIR

# ── Répertoire d'état ────────────────────────────────────────────────────────
#
# Le volume que l'utilisateur ne doit jamais perdre : il porte la clé secrète.
STATE_DIR = Path(os.environ.get("MAISONNEE_STATE_DIR", "/data"))

# Un `.env` monté par l'hébergeur doit gagner sur tous les défauts ci-dessous.
# `read_env` pose ses valeurs par `setdefault`, donc l'ordre décide : on le lit
# **avant** de remplir quoi que ce soit. (`production.py` le relira ensuite, sans
# effet — tout est déjà dans l'environnement.)
environ.Env.read_env(BASE_DIR / ".env")


def _persisted_secret_key() -> str:
    """La clé secrète de l'instance, générée une fois puis relue.

    Elle vit dans un fichier plutôt que dans l'environnement parce que personne
    ne doit avoir à en fabriquer une pour démarrer — et parce que trois
    conteneurs (``init``, ``web``, les schedulers) doivent lire **la même**.

    Ne pas pouvoir l'écrire est une **erreur fatale**, pas un repli silencieux.
    Générer une clé volatile par conteneur marcherait à l'écran : l'application
    démarre, la connexion réussit, et les sessions sautent au premier
    redémarrage sans que rien ne dise pourquoi.
    """
    path = STATE_DIR / "secret_key"
    try:
        existing = path.read_text(encoding="utf-8").strip()
    except OSError:
        existing = ""
    if existing:
        return existing

    key = secrets.token_urlsafe(64)
    try:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        # Écriture atomique : deux conteneurs qui démarrent ensemble ne doivent
        # pas pouvoir lire un fichier à moitié écrit.
        tmp = path.with_name(path.name + ".tmp")
        tmp.write_text(key, encoding="utf-8")
        os.chmod(tmp, 0o600)
        os.replace(tmp, path)
    except OSError as exc:
        raise ImproperlyConfigured(
            f"Impossible d'écrire la clé secrète dans {STATE_DIR} ({exc}). "
            "Monte un volume inscriptible sur ce chemin (ou fixe MAISONNEE_STATE_DIR), "
            "ou fournis SECRET_KEY dans l'environnement."
        ) from exc
    return key


# ── L'unique bouton ──────────────────────────────────────────────────────────

PUBLIC_URL = os.environ.get("MAISONNEE_PUBLIC_URL", "").strip().rstrip("/")
_public_host = urlsplit(PUBLIC_URL).hostname if PUBLIC_URL else ""
_is_public_https = PUBLIC_URL.startswith("https://")

# Sans adresse publique, l'instance se joint en clair sur le port publié.
_local_url = f"http://localhost:{os.environ.get('MAISONNEE_PORT', '8000')}"

if not os.environ.get("SECRET_KEY"):
    os.environ["SECRET_KEY"] = _persisted_secret_key()

_DEFAULTS = {
    # `db` est le nom du service dans le compose livré ; les identifiants aussi.
    "DATABASE_URL": "postgres://maisonnee:maisonnee@db:5432/maisonnee",
    # Voir la docstring : la liste se resserre quand l'exposition s'élargit.
    "ALLOWED_HOSTS": _public_host or "*",
    # La SPA est servie par Django lui-même : le CORS ne sert qu'à un front
    # lancé à part en développement. Une valeur est quand même requise —
    # `production.py` refuse de démarrer sans, et c'est une bonne chose.
    "CORS_ALLOWED_ORIGINS": PUBLIC_URL or _local_url,
    "FRONTEND_URL": PUBLIC_URL or _local_url,
    "SESSION_COOKIE_SECURE": str(_is_public_https),
    "CSRF_COOKIE_SECURE": str(_is_public_https),
    # Voir la docstring : la redirection appartient au proxy qui termine le TLS.
    "SECURE_SSL_REDIRECT": "False",
    "SECURE_HSTS_SECONDS": "31536000" if _is_public_https else "0",
    "SECURE_HSTS_INCLUDE_SUBDOMAINS": str(_is_public_https),
    "SECURE_HSTS_PRELOAD": "False",
    # Sans clé SMTP, un e-mail part dans les logs du conteneur plutôt que nulle
    # part — et la capacité `email` du registre le déclare à l'interface, qui
    # propose alors le lien d'invitation à copier au lieu d'un envoi muet.
    "EMAIL_BACKEND": "django.core.mail.backends.console.EmailBackend",
}
if PUBLIC_URL:
    _DEFAULTS["CSRF_TRUSTED_ORIGINS"] = PUBLIC_URL

for _key, _value in _DEFAULTS.items():
    os.environ.setdefault(_key, _value)

from .production import *  # noqa: E402,F401,F403  (après les défauts, exprès)

# ── Ce qui ne passe pas par l'environnement ──────────────────────────────────

# La sonde de vie du conteneur tape sa propre boucle locale. Sans ces deux noms,
# une instance qui déclare `MAISONNEE_PUBLIC_URL` réduit `ALLOWED_HOSTS` à son
# seul domaine public et se déclare malade à perpétuité — Django refusant en 400
# la requête que le conteneur s'adresse à lui-même. Ce ne sont pas des hôtes
# supplémentaires exposés : rien d'extérieur ne peut se présenter comme la
# boucle locale du conteneur.
ALLOWED_HOSTS = list(dict.fromkeys([*ALLOWED_HOSTS, "127.0.0.1", "localhost"]))  # noqa: F405

# Pas de Nginx dans la pile auto-hébergée : Django sert les fichiers lui-même.
# Déclaré ici plutôt que déduit de `DEBUG` — voir `core.views_media`.
PROTECTED_MEDIA_ACCEL = False

# Les fichiers du foyer vivent dans le volume d'état, avec la clé secrète : ce
# sont les deux choses qu'une sauvegarde doit prendre en plus de la base.
MEDIA_ROOT = STATE_DIR / "media"
