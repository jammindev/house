#!/bin/sh
#
# Mise en état d'une instance auto-hébergée, avant que quoi que ce soit ne serve.
#
# Lancé par le service `init` du `docker-compose.yml`, dont `web` dépend en
# `service_completed_successfully` : le serveur ne démarre donc jamais sur un
# schéma non migré.
#
# ⚠️ Ce script n'est PAS un ENTRYPOINT, et ne doit jamais le devenir.
#
# Le `Dockerfile` porte la note complète ; l'essentiel tient en deux phrases. Le
# `CMD` de l'image doit rester remplaçable pour que le déploiement de l'auteur
# puisse lancer `compose run --rm web python manage.py migrate` sur l'image
# neuve — c'est-à-dire migrer AVANT de basculer le trafic. Un entrypoint qui
# migre au démarrage ferait migrer le conteneur au moment même où il commence à
# servir, et supprimerait la seule garantie que le déploiement en place existe
# pour tenir.
#
# Ce que ça donne : une même image, deux façons de l'installer, aucune des deux
# n'ayant à connaître l'autre.
set -eu

echo "→ Maisonnée : mise en état de l'instance"

# ── 1. Attendre la base ──────────────────────────────────────────────────────
#
# Le compose déclare déjà `depends_on: db: condition: service_healthy`, donc ce
# n'est pas la première ligne de défense. Elle sert au cas que le healthcheck ne
# couvre pas : PostgreSQL accepte les connexions, puis se redémarre une fois
# pendant sa toute première initialisation.
attempt=0
until python -c "
import django, os
django.setup()
from django.db import connection
connection.ensure_connection()
" 2>/dev/null; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 60 ]; then
        echo "✗ La base ne répond pas après 60 tentatives. Vérifie le service 'db'." >&2
        exit 1
    fi
    [ "$attempt" -eq 1 ] && echo "   en attente de la base…"
    sleep 2
done
echo "   base disponible"

# ── 2. Le schéma ─────────────────────────────────────────────────────────────
python manage.py migrate --noinput

# ── 3. Le premier compte ─────────────────────────────────────────────────────
#
# Idempotent : ne fait rien si un compte existe (voir core/management/commands).
python manage.py create_admin

# Le foyer de démonstration n'est PAS ici : il est un service à part, sous le
# profil `demo` du compose. Le semer d'office réveillerait « Famille Mercier »
# dans l'instance de quelqu'un qui a commencé à saisir ses vraies données.

echo "✓ Instance prête"
