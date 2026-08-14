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
#
# `-v 0` : une quarantaine de lignes « Applying trackers.0003_remove_… OK » sont
# rassurantes pour qui a écrit les migrations, et alarmantes pour tout le monde
# d'autre — c'est la première chose qu'un inconnu voit du produit. En cas
# d'échec, `set -e` arrête tout et la trace Django reste complète : on ne perd
# que le bruit du succès.
echo "   mise à jour du schéma…"
python manage.py migrate --noinput -v 0
echo "   schéma à jour"

# ── 3. Le premier compte ─────────────────────────────────────────────────────
#
# Ne crée quelque chose que si `MAISONNEE_ADMIN_PASSWORD` est fourni, c'est-à-dire
# en installation non surveillée. Sinon il ne se passe rien ici, et le premier
# visiteur configure l'instance dans l'interface (issue #591).
#
# Idempotent dans les deux cas : ne fait rien si un compte existe.
python manage.py create_admin

# Le foyer de démonstration n'est PAS ici : il est un service à part, sous le
# profil `demo` du compose. Le semer d'office réveillerait « Famille Mercier »
# dans l'instance de quelqu'un qui a commencé à saisir ses vraies données.

# ── 4. Où aller ──────────────────────────────────────────────────────────────
#
# La dernière ligne que l'installateur lit doit être une adresse, pas un statut.
# `MAISONNEE_PUBLIC_URL` gagne quand elle est posée — l'instance est alors
# derrière un proxy, et `localhost` y serait un mensonge.
url="${MAISONNEE_PUBLIC_URL:-http://localhost:${MAISONNEE_PORT:-8000}}"
line="────────────────────────────────────────────────────────────────"
echo ""
echo "$line"
echo "  Maisonnée est prête."
echo ""
echo "  Ouvre  $url"
if [ -z "${MAISONNEE_ADMIN_PASSWORD:-}" ]; then
    echo "  et crée ton compte : c'est la première chose que l'écran demande."
fi
echo "$line"
echo ""
