#!/usr/bin/env bash
set -euo pipefail

# Sauvegarde → base neuve → restauration → assertions. Exécuté, pas décrit.
#
# Pourquoi un test et pas un paragraphe de doc : une procédure de restauration
# écrite est vraie le jour où on l'écrit. Ce qui la périme ne se voit jamais dans
# une relecture — une extension ajoutée au schéma (`vector`, `unaccent`), une
# option de `pg_dump` qui change de sens, un `psql` qui sort 0 après avoir
# échoué. Le jour où ça compte, on ne découvre pas ces choses-là : on les subit.
#
# Ce que le test tient exactement :
#
#   1. Le dump d'un schéma **réel** (migrations Django complètes, extensions
#      comprises) se recharge sur une base vide sans erreur.
#   2. Les données sont là après coup — pas seulement les tables.
#   3. Le répertoire d'état (clé secrète + fichiers) fait l'aller-retour.
#   4. `restore_db.sh` **refuse** une restauration à moitié : sans archive
#      d'état, il faut le dire.
#
# Usage : DATABASE_URL=postgres://user:pass@host:5432/postgres ./scripts/test-backup-restore.sh
#
# `DATABASE_URL` désigne une base sur laquelle on a le droit de faire
# `CREATE DATABASE` : le script crée les deux siennes, et les supprime en
# sortant, quelle qu'en soit la raison.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Error: DATABASE_URL must point at a PostgreSQL server (any database)." >&2
  exit 1
fi

for binary in psql pg_dump python; do
  if ! command -v "$binary" >/dev/null 2>&1; then
    echo "Error: $binary is not installed or not in PATH" >&2
    exit 1
  fi
done

STAMP="$(date +%s)_$$"
SOURCE_DB="maisonnee_backup_src_${STAMP}"
TARGET_DB="maisonnee_backup_dst_${STAMP}"
WORK_DIR="$(mktemp -d)"

# L'URL du serveur, sans la base : on y raccroche les noms qu'on crée.
SERVER_URL="${DATABASE_URL%/*}"
ADMIN_URL="$DATABASE_URL"
SOURCE_URL="$SERVER_URL/$SOURCE_DB"
TARGET_URL="$SERVER_URL/$TARGET_DB"

cleanup() {
  # Toujours, même sur échec : un test qui laisse deux bases derrière lui rend
  # le suivant rouge pour une raison qui n'a rien à voir.
  psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS $SOURCE_DB WITH (FORCE)" >/dev/null 2>&1 || true
  psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS $TARGET_DB WITH (FORCE)" >/dev/null 2>&1 || true
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

fail() {
  echo "✗ $1" >&2
  exit 1
}

echo "→ 1/6  Deux bases neuves"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE $SOURCE_DB"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE $TARGET_DB"

echo "→ 2/6  Le schéma réel, migrations comprises"
# Le schéma réel et pas une table jouet : c'est lui qui porte les extensions et
# les types dont la restauration peut échouer.
DATABASE_URL="$SOURCE_URL" \
DJANGO_SETTINGS_MODULE=config.settings.test \
  python manage.py migrate --noinput >/dev/null

# Une ligne qu'on saura reconnaître de l'autre côté, dans une table à nous.
#
# Pas une table métier, exprès : ce test regarde le **format du dump**, et
# l'accrocher aux colonnes de `households` le ferait rougir le jour où ce modèle
# gagne un champ obligatoire — un rouge qui n'apprendrait rien sur la
# restauration. Le schéma réel reste intégralement sauvegardé et restauré ; c'est
# le compte de tables et l'extension, plus bas, qui l'attestent.
MARKER="maisonnée-restauration-${STAMP}"
psql "$SOURCE_URL" -v ON_ERROR_STOP=1 -q \
  -c "CREATE TABLE restore_marker (id serial PRIMARY KEY, label text NOT NULL)" \
  -c "INSERT INTO restore_marker (label) VALUES ('$MARKER')"

SOURCE_TABLES="$(psql "$SOURCE_URL" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")"
[[ "$SOURCE_TABLES" -gt 20 ]] || fail "schéma source suspect : $SOURCE_TABLES tables"

echo "→ 3/6  Un répertoire d'état, comme celui du volume"
STATE_SRC="$WORK_DIR/state"
mkdir -p "$STATE_SRC/media/documents"
echo "clé-secrète-$STAMP" > "$STATE_SRC/secret_key"
echo "contenu-document-$STAMP" > "$STATE_SRC/media/documents/facture.txt"

echo "→ 4/6  Sauvegarde"
./backup_db.sh \
  --db-url "$SOURCE_URL" \
  --out-dir "$WORK_DIR/backups" \
  --prefix maisonnee \
  --state-dir "$STATE_SRC" >/dev/null

DUMP="$(ls -1t "$WORK_DIR"/backups/maisonnee_*.sql.gz | head -n 1)"
[[ -f "$DUMP" ]] || fail "aucun dump produit"
[[ -f "${DUMP%.sql.gz}_state.tar.gz" ]] || fail "aucune archive d'état produite"

echo "→ 5/6  Le refus d'une restauration à moitié"
# Le garde-fou compte autant que la restauration : on le vérifie sur une copie
# du dump privée de son archive jumelle.
LONELY="$WORK_DIR/lonely_20200101_000000.sql.gz"
cp "$DUMP" "$LONELY"
if ./restore_db.sh --from "$LONELY" --db-url "$TARGET_URL" --yes >/dev/null 2>&1; then
  fail "restore_db.sh a restauré sans archive d'état, sans --db-only"
fi

echo "→ 6/6  Restauration sur la base neuve"
STATE_DST="$WORK_DIR/state-restored"
./restore_db.sh \
  --from "$DUMP" \
  --db-url "$TARGET_URL" \
  --state-dir "$STATE_DST" \
  --yes >/dev/null

# ── Assertions ───────────────────────────────────────────────────────────────

TARGET_TABLES="$(psql "$TARGET_URL" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")"
[[ "$TARGET_TABLES" == "$SOURCE_TABLES" ]] \
  || fail "tables restaurées : $TARGET_TABLES, attendu $SOURCE_TABLES"

RESTORED="$(psql "$TARGET_URL" -tAc \
  "SELECT count(*) FROM restore_marker WHERE label = '$MARKER'")"
[[ "$RESTORED" == "1" ]] || fail "la ligne témoin n'a pas survécu au voyage"

# L'extension du schéma est bien là — c'est elle qui casse une restauration sur
# une image Postgres nue, et le mode d'échec est silencieux jusqu'à la première
# recherche sémantique.
HAS_VECTOR="$(psql "$TARGET_URL" -tAc \
  "SELECT count(*) FROM pg_extension WHERE extname = 'vector'")"
[[ "$HAS_VECTOR" == "1" ]] || fail "l'extension vector n'a pas été restaurée"

[[ "$(cat "$STATE_DST/secret_key")" == "clé-secrète-$STAMP" ]] \
  || fail "la clé secrète n'a pas été restaurée"
[[ "$(cat "$STATE_DST/media/documents/facture.txt")" == "contenu-document-$STAMP" ]] \
  || fail "les fichiers du foyer n'ont pas été restaurés"

echo
echo "✓ Sauvegarde et restauration vérifiées de bout en bout"
echo "  $SOURCE_TABLES tables, la ligne témoin, l'extension vector, la clé et les fichiers."
