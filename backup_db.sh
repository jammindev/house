#!/usr/bin/env bash
set -euo pipefail

# Create a compressed PostgreSQL backup from DATABASE_URL and rotate old backups.
# Usage: ./backup_db.sh [--keep N] [--out-dir DIR] [--db-url URL] [--prefix NAME]

KEEP="10"
OUT_DIR="backups"
PREFIX="house_db"
DB_URL="${DATABASE_URL:-}"

usage() {
  cat <<'EOF'
Usage: ./backup_db.sh [options]

Options:
  --keep N         Keep only the N most recent backup files (default: 10)
  --out-dir DIR    Backup output directory (default: backups)
  --db-url URL     PostgreSQL connection URL (default: DATABASE_URL env var or .env.local)
  --prefix NAME    Backup filename prefix (default: house_db)
  -h, --help       Show this help
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

mkdir -p "$OUT_DIR"
ts="$(date +%Y%m%d_%H%M%S)"
out_file="$OUT_DIR/${PREFIX}_${ts}.sql.gz"

pg_dump "$DB_URL" --no-owner --no-privileges | gzip > "$out_file"

# Verify archive integrity right away.
gzip -t "$out_file"

# Rotate old backups (newest first, delete files after KEEP).
if [[ "$KEEP" -ge 0 ]]; then
  files=()
  while IFS= read -r line; do
    files+=("$line")
  done < <(ls -1t "$OUT_DIR"/${PREFIX}_*.sql.gz 2>/dev/null || true)

  if [[ "${#files[@]}" -gt "$KEEP" ]]; then
    i="$KEEP"
    while [[ "$i" -lt "${#files[@]}" ]]; do
      rm -f "${files[$i]}"
      i=$((i + 1))
    done
  fi
fi

echo "Backup created: $out_file"
shasum -a 256 "$out_file"
