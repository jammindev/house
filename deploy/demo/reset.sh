#!/usr/bin/env bash
#
# Remise à zéro de l'instance de démonstration.
#
# La démo est **modifiable** : un visiteur qui ne peut rien changer ne sait pas
# ce que ça fait de s'en servir. Le prix, c'est qu'elle se dégrade — des lignes
# saisies au hasard, des choses supprimées. D'où ce script, appelé par cron.
#
# Deux choses à savoir avant de toucher à la cadence :
#
#   - `seed_demo_data --flush` est borné au foyer « Famille Mercier ». Il ne peut
#     pas toucher autre chose, et il n'y a rien d'autre sur cette instance.
#   - Les embeddings sont posés par un signal `post_save`. Semer signal allumé,
#     c'est ~650 appels unitaires au fournisseur chaque nuit ; on l'éteint et on
#     rattrape en lots avec `backfill_embeddings`.
#
# La cadence vit dans la crontab, pas ici — une ligne à changer si un jour
# d'annonce la démo se dégrade avant midi. Voir DEPLOYMENT.md § 11.
set -euo pipefail

cd "$(dirname "$0")"

# `--flush` recrée aussi les trois comptes, donc le mot de passe doit être
# repassé : sans lui la commande retomberait sur celui, publié, du dépôt.
set -a
# shellcheck disable=SC1091
source .env
set +a

echo "[$(date -Is)] remise à zéro de la démonstration"

docker compose exec -T \
  -e EMBEDDING_INDEXING_ENABLED=0 \
  web python manage.py seed_demo_data --flush --password "${DEMO_PASSWORD}"

docker compose exec -T web python manage.py backfill_embeddings

echo "[$(date -Is)] terminé"
