#!/usr/bin/env bash
set -euo pipefail

# Le pendant en lecture de `backup_db.sh`.
#
# Une sauvegarde jamais restaurée n'est pas une sauvegarde : c'est un fichier
# dont on espère quelque chose. Ce script existe pour que la restauration soit un
# geste **connu**, exécuté au moins une fois avant le jour où elle compte — et
# `scripts/test-backup-restore.sh` le rejoue à chaque CI, sur une base neuve.
#
# Trois refus délibérés :
#
#   1. **Il écrase.** Restaurer, c'est remplacer le contenu de la base cible —
#      d'où la confirmation explicite : il faut retaper le nom de la base, ou
#      passer --yes. Un `--force` qu'on tape par habitude ne protège personne.
#   2. **Il ne restaure pas la base sans les fichiers en silence.** Si l'archive
#      d'état jumelle manque, il le dit et demande --db-only. Une base restaurée
#      seule référence des documents qui n'existent plus.
#   3. **Il refuse une extension absente.** Le dump contient `CREATE EXTENSION
#      vector` : restaurer sur un Postgres nu échoue à mi-parcours, en laissant
#      une base à moitié peuplée. Mieux vaut ne pas commencer.
#
# Usage: ./restore_db.sh --from FILE.sql.gz [--db-url URL] [--state-dir DIR]
#                        [--db-only] [--yes]

DUMP=""
DB_URL="${DATABASE_URL:-}"
STATE_DIR=""
DB_ONLY="0"
ASSUME_YES="0"

usage() {
  cat <<'EOF'
Usage: ./restore_db.sh --from FILE.sql.gz [options]

Options:
  --from FILE      The .sql.gz produced by backup_db.sh (required)
  --db-url URL     Target PostgreSQL URL (default: DATABASE_URL env var or .env.local)
  --state-dir DIR  Where to restore the state archive (secret key + uploaded files).
                   Its contents are replaced.
  --db-only        Restore the database only, and say so. Required when the
                   matching *_state.tar.gz is missing.
  --yes            Skip the interactive confirmation (for scripts and CI)
  -h, --help       Show this help

This REPLACES the target database. Stop the application first.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from)
      DUMP="$2"
      shift 2
      ;;
    --db-url)
      DB_URL="$2"
      shift 2
      ;;
    --state-dir)
      STATE_DIR="$2"
      shift 2
      ;;
    --db-only)
      DB_ONLY="1"
      shift
      ;;
    --yes)
      ASSUME_YES="1"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$DUMP" ]]; then
  echo "Error: --from is required" >&2
  usage
  exit 1
fi

if [[ ! -f "$DUMP" ]]; then
  echo "Error: no such file: $DUMP" >&2
  exit 1
fi

if [[ -z "$DB_URL" ]] && [[ -f ".env.local" ]]; then
  DB_URL="$(grep '^DATABASE_URL=' .env.local | head -n 1 | cut -d'=' -f2-)"
fi

if [[ -z "$DB_URL" ]]; then
  echo "Error: DATABASE_URL is not set and .env.local has no DATABASE_URL" >&2
  exit 1
fi

for binary in psql gunzip; do
  if ! command -v "$binary" >/dev/null 2>&1; then
    echo "Error: $binary is not installed or not in PATH" >&2
    exit 1
  fi
done

# L'archive est-elle lisible ? Le savoir maintenant, pas au milieu du `psql`.
gzip -t "$DUMP"

# ── L'archive d'état jumelle ────────────────────────────────────────────────
#
# Appariée par l'horodatage, pas par une convention que l'utilisateur devrait
# retenir : `..._20260803_101500.sql.gz` ↔ `..._20260803_101500_state.tar.gz`.
STATE_ARCHIVE="${DUMP%.sql.gz}_state.tar.gz"
if [[ ! -f "$STATE_ARCHIVE" ]]; then
  STATE_ARCHIVE=""
fi

if [[ -z "$STATE_ARCHIVE" ]] && [[ "$DB_ONLY" != "1" ]]; then
  cat >&2 <<EOF
Error: no state archive next to this dump.

  expected: ${DUMP%.sql.gz}_state.tar.gz

The database alone restores an instance whose documents are all referenced and
missing, and whose secret key is new (everyone is logged out). If that is really
what you want, say so: re-run with --db-only.
EOF
  exit 1
fi

if [[ -n "$STATE_ARCHIVE" ]] && [[ "$DB_ONLY" != "1" ]] && [[ -z "$STATE_DIR" ]]; then
  echo "Error: this backup carries a state archive — pass --state-dir DIR to restore it," >&2
  echo "       or --db-only to deliberately leave it out." >&2
  exit 1
fi

# Le nom de la base, pour la confirmation et pour le message final. Extrait de
# l'URL sans en afficher le mot de passe.
DB_NAME="$(printf '%s' "$DB_URL" | sed -E 's#^[^/]*//[^/]*/##; s#\?.*$##')"
DB_HOST="$(printf '%s' "$DB_URL" | sed -E 's#^[^/]*//##; s#^[^@]*@##; s#/.*$##')"

echo "About to REPLACE the contents of:"
echo "  database   $DB_NAME  (on $DB_HOST)"
if [[ -n "$STATE_ARCHIVE" ]] && [[ "$DB_ONLY" != "1" ]]; then
  echo "  state dir  $STATE_DIR  (replaced by $STATE_ARCHIVE)"
else
  echo "  state dir  — not restored (--db-only)"
fi
echo

if [[ "$ASSUME_YES" != "1" ]]; then
  # Retaper le nom : la seule confirmation qu'on ne donne pas par réflexe.
  printf "Type the database name to confirm: "
  read -r typed
  if [[ "$typed" != "$DB_NAME" ]]; then
    echo "Aborted — '$typed' does not match '$DB_NAME'." >&2
    exit 1
  fi
fi

# ── L'extension attendue est-elle disponible ? ──────────────────────────────
#
# Le dump porte `CREATE EXTENSION vector`. Sur un Postgres nu, `psql` échoue à
# cette ligne — après avoir déjà créé la moitié des tables. On regarde avant.
if gunzip -c "$DUMP" | grep -qi 'CREATE EXTENSION.*vector'; then
  available="$(psql "$DB_URL" -tAc \
    "SELECT 1 FROM pg_available_extensions WHERE name = 'vector'" 2>/dev/null || true)"
  if [[ "$available" != "1" ]]; then
    cat >&2 <<'EOF'
Error: this dump needs the `vector` extension, and the target server does not
have it available.

Use the same image the stack ships with (pgvector/pgvector:pg16). Restoring
onto a bare postgres image fails halfway through and leaves a partial database.
EOF
    exit 1
  fi
fi

echo "→ Dropping the current schema"
# `DROP SCHEMA public CASCADE` plutôt que `DROP DATABASE` : le script n'a pas
# besoin des droits de création de base, et la cible peut être gérée par un
# hébergeur qui ne les donne pas. Le dump recrée tout ce qu'il contient.
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -c 'DROP SCHEMA IF EXISTS public CASCADE;' \
                                   -c 'CREATE SCHEMA public;'

echo "→ Restoring the database"
# ON_ERROR_STOP : sans lui, `psql` continue après une erreur et sort 0. Une
# restauration qui se déclare réussie en ayant perdu une table est le seul
# résultat pire qu'un échec.
gunzip -c "$DUMP" | psql "$DB_URL" -v ON_ERROR_STOP=1 -q

if [[ -n "$STATE_ARCHIVE" ]] && [[ "$DB_ONLY" != "1" ]]; then
  echo "→ Restoring the state directory"
  gzip -t "$STATE_ARCHIVE"
  mkdir -p "$STATE_DIR"
  # Vider d'abord : un `tar -x` par-dessus laisserait cohabiter les fichiers de
  # l'instance précédente avec ceux de la sauvegarde, et personne ne saurait
  # dire lesquels font foi.
  find "$STATE_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  tar -xzf "$STATE_ARCHIVE" -C "$STATE_DIR"
fi

echo
echo "✓ Restored into $DB_NAME"
if [[ "$DB_ONLY" == "1" ]]; then
  echo "  Database only — uploaded files and secret key were NOT restored."
fi
echo "  Start the application and check that you can log in and open a document."
