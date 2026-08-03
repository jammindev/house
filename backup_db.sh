#!/usr/bin/env bash
set -euo pipefail

# Sauvegarde d'une instance : la base, et — si on le lui demande — le répertoire
# d'état qui porte la clé secrète et les fichiers du foyer.
#
# ⚠️ Une sauvegarde de la base seule n'est pas une sauvegarde de l'instance.
# Restaurer la base sans les fichiers laisse chaque document référencé et absent,
# et perdre la clé secrète déconnecte tout le monde, base intacte. Les deux
# archives portent donc le **même horodatage** : c'est ce qui permet à
# `restore_db.sh` de retrouver la seconde toute seule, et de refuser en silence
# une restauration à moitié.
#
# Usage: ./backup_db.sh [--keep N] [--out-dir DIR] [--db-url URL] [--prefix NAME]
#                       [--state-dir DIR]

KEEP="10"
OUT_DIR="backups"
PREFIX="house_db"
DB_URL="${DATABASE_URL:-}"
STATE_DIR=""

usage() {
  cat <<'EOF'
Usage: ./backup_db.sh [options]

Options:
  --keep N         Keep only the N most recent backups (default: 10)
  --out-dir DIR    Backup output directory (default: backups)
  --db-url URL     PostgreSQL connection URL (default: DATABASE_URL env var or .env.local)
  --prefix NAME    Backup filename prefix (default: house_db)
  --state-dir DIR  Also archive this directory (secret key + uploaded files).
                   Self-hosted stacks: the `maisonnee-state` volume, mounted at /data.
  -h, --help       Show this help

Produces:
  DIR/PREFIX_<timestamp>.sql.gz          the database
  DIR/PREFIX_<timestamp>_state.tar.gz    the state directory, when --state-dir is given

Both share one timestamp on purpose — restore_db.sh pairs them by it.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep)
      KEEP="$2"
      shift 2
      ;;
    --out-dir)
      OUT_DIR="$2"
      shift 2
      ;;
    --db-url)
      DB_URL="$2"
      shift 2
      ;;
    --prefix)
      PREFIX="$2"
      shift 2
      ;;
    --state-dir)
      STATE_DIR="$2"
      shift 2
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

if ! [[ "$KEEP" =~ ^[0-9]+$ ]]; then
  echo "Error: --keep must be an integer >= 0" >&2
  exit 1
fi

if [[ -z "$DB_URL" ]] && [[ -f ".env.local" ]]; then
  DB_URL="$(grep '^DATABASE_URL=' .env.local | head -n 1 | cut -d'=' -f2-)"
fi

if [[ -z "$DB_URL" ]]; then
  echo "Error: DATABASE_URL is not set and .env.local has no DATABASE_URL" >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "Error: pg_dump is not installed or not in PATH" >&2
  exit 1
fi

if [[ -n "$STATE_DIR" ]] && [[ ! -d "$STATE_DIR" ]]; then
  echo "Error: --state-dir '$STATE_DIR' is not a directory" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
ts="$(date +%Y%m%d_%H%M%S)"
out_file="$OUT_DIR/${PREFIX}_${ts}.sql.gz"

pg_dump "$DB_URL" --no-owner --no-privileges | gzip > "$out_file"

# Verify archive integrity right away.
gzip -t "$out_file"

state_file=""
if [[ -n "$STATE_DIR" ]]; then
  state_file="$OUT_DIR/${PREFIX}_${ts}_state.tar.gz"
  # `-C` so paths inside the archive are relative: restoring must not depend on
  # where the directory happened to live on the machine that made the backup.
  tar -czf "$state_file" -C "$STATE_DIR" .
  gzip -t "$state_file"
fi

# Rotate old backups (newest first, delete files after KEEP). The state archive
# of a rotated-out backup goes with it — keeping an orphan state archive next to
# no database is how a backup directory starts lying about what it can restore.
if [[ "$KEEP" -ge 0 ]]; then
  files=()
  while IFS= read -r line; do
    files+=("$line")
  done < <(ls -1t "$OUT_DIR"/${PREFIX}_*.sql.gz 2>/dev/null || true)

  if [[ "${#files[@]}" -gt "$KEEP" ]]; then
    i="$KEEP"
    while [[ "$i" -lt "${#files[@]}" ]]; do
      rm -f "${files[$i]}"
      rm -f "${files[$i]%.sql.gz}_state.tar.gz"
      i=$((i + 1))
    done
  fi
fi

echo "Backup created: $out_file"
shasum -a 256 "$out_file"
if [[ -n "$state_file" ]]; then
  echo "State archived:  $state_file"
  shasum -a 256 "$state_file"
else
  echo "Note: no --state-dir given — this backup restores the database only," >&2
  echo "      not the uploaded files nor the instance secret key." >&2
fi
