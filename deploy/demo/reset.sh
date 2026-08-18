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
# Le script fait donc DEUX choses, et la seconde est facile à oublier : il remet
# les données à zéro, et il **rattrape la dernière release publiée**. C'est le seul
# mécanisme qui met la vitrine à jour — aucun workflow ne s'en charge.
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

# ── Rattraper la dernière release, AVANT de resemer ─────────────────────────
#
# La vitrine consomme le paquet publié (`ghcr.io/...:latest`), pas les sources —
# c'est ce qui l'empêche de montrer des fonctionnalités qu'une installation ne
# donnerait pas. La contrepartie est qu'elle ne bouge qu'aux releases, et rien
# dans la CI ne la met à jour : ce `pull` est le seul mécanisme qui l'y amène.
#
# ⚠️ Les deux commandes comptent, et le `pull` seul serait un demi-correctif.
# La seed exécutée plus bas est **le code de l'image**, lancé par `exec` dans le
# conteneur DÉJÀ démarré : tirer une image neuve sans recréer le conteneur ferait
# tourner l'ancienne seed indéfiniment, en donnant l'impression de se mettre à
# jour. `up -d` ne recrée que si l'image a réellement changé.
docker compose pull --quiet
docker compose up -d --wait --wait-timeout 180 --no-deps web

docker compose exec -T \
  -e EMBEDDING_INDEXING_ENABLED=0 \
  web python manage.py seed_demo_data --flush --password "${DEMO_PASSWORD}"

# Même garde que dans le compose : la commande lève si la clé est absente, et le
# `set -e` ferait échouer le cron chaque nuit sur une capacité facultative — alors
# que la remise à zéro, elle, a parfaitement réussi.
if [ -n "${VOYAGE_API_KEY:-}" ]; then
  docker compose exec -T web python manage.py backfill_embeddings
else
  echo "[$(date -Is)] VOYAGE_API_KEY absente : indexation sémantique ignorée"
fi

echo "[$(date -Is)] terminé"
