# Backup and restore

A backup you have never restored is not a backup — it is a file you have hopes
about. This page is written in that order on purpose: restoring first, because
that is the part nobody rehearses.

## What has to be saved

Two volumes, and you need **both**:

| Volume | Holds | If you lose it |
|---|---|---|
| `postgres-data` | The database | Everything |
| `maisonnee-state` | The instance secret key **and** every uploaded file | Every document is referenced and missing, and everyone is logged out — with the database perfectly intact |

That second row is the one that catches people. A database-only backup restores
an instance that looks fine on the dashboard and is hollow the moment anyone
opens a document.

So a backup here is **a pair of files sharing one timestamp**:

```
maisonnee_20260803_020000.sql.gz          the database
maisonnee_20260803_020000_state.tar.gz    the secret key + the files
```

The shared timestamp is not cosmetic: it is what lets a restore find the second
file on its own, and refuse to half-restore when it is missing.

## Backing up

Find your volume names first — Compose prefixes them with the directory name:

```bash
docker volume ls | grep maisonnee
# e.g. maisonnee_maisonnee-state
```

Then, from the directory holding your `docker-compose.yml`:

```bash
#!/usr/bin/env bash
set -euo pipefail

STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$HOME/maisonnee-backups"
STATE_VOLUME="maisonnee_maisonnee-state"   # from `docker volume ls`
mkdir -p "$OUT"

# 1. The database
docker compose exec -T db \
  pg_dump -U maisonnee maisonnee --no-owner --no-privileges \
  | gzip > "$OUT/maisonnee_${STAMP}.sql.gz"

# 2. The secret key and the files, same timestamp
docker run --rm \
  -v "${STATE_VOLUME}:/data:ro" \
  -v "$OUT:/backup" \
  alpine tar -czf "/backup/maisonnee_${STAMP}_state.tar.gz" -C /data .

gzip -t "$OUT/maisonnee_${STAMP}.sql.gz"
gzip -t "$OUT/maisonnee_${STAMP}_state.tar.gz"
echo "Backup: $OUT/maisonnee_${STAMP}.*"
```

You can run this while the app is up: `pg_dump` takes a consistent snapshot, and
the files only ever get added to.

Put it in `cron` and **copy the result off the machine**. A backup that lives on
the disk it protects covers you against a mistake, not against the disk.

```
0 2 * * * /home/you/maisonnee-backup.sh >> /home/you/backup.log 2>&1
```

## Restoring

> Stop the application first. Restoring into a database something is writing to
> gives you a result nobody can characterise.

```bash
docker compose stop web scheduler scheduler-briefings

STAMP=20260803_020000
OUT="$HOME/maisonnee-backups"
STATE_VOLUME="maisonnee_maisonnee-state"

# 1. Replace the schema, then load the dump.
#    ON_ERROR_STOP matters: without it psql keeps going after a failure and
#    exits 0 — a restore that reports success having lost a table is the only
#    outcome worse than a failure.
docker compose exec -T db psql -U maisonnee -d maisonnee -v ON_ERROR_STOP=1 \
  -c 'DROP SCHEMA IF EXISTS public CASCADE;' -c 'CREATE SCHEMA public;'

gunzip -c "$OUT/maisonnee_${STAMP}.sql.gz" \
  | docker compose exec -T db psql -U maisonnee -d maisonnee -v ON_ERROR_STOP=1 -q

# 2. Replace the state volume — emptied first, so files from the instance you
#    are replacing cannot survive alongside the ones you are restoring.
docker run --rm \
  -v "${STATE_VOLUME}:/data" \
  -v "$OUT:/backup:ro" \
  alpine sh -c 'rm -rf /data/* /data/..?* /data/.[!.]* 2>/dev/null; \
                tar -xzf /backup/maisonnee_'"${STAMP}"'_state.tar.gz -C /data'

docker compose up -d
```

Then — and this is the actual test — **log in and open a document**. A restore
that has not been looked at is a restore that has not happened.

### Restoring onto a different machine

Same commands. Two things to get right:

- **Use the same database image**, `pgvector/pgvector:pg16`. The dump contains
  `CREATE EXTENSION vector`; a bare `postgres:16` fails on that line, halfway
  through, leaving a partial database.
- **Restore the state volume too.** A new machine generates a fresh secret key
  if the volume is empty, which logs everybody out — and the documents simply
  aren't there.

### Restoring the database only

Sometimes that is genuinely what you want (you are recovering a bad import and
the files never changed). Do it knowingly: skip step 2, and expect uploaded
documents to be whatever the current volume holds.

## The scripts in the repository

If you have `psql` on the host — the author's deployment does, and CI does —
`backup_db.sh` and `restore_db.sh` at the repository root are the same procedure
with the sharp edges filed off:

```bash
./backup_db.sh  --db-url "$DATABASE_URL" --out-dir backups --state-dir /var/lib/maisonnee
./restore_db.sh --from backups/house_db_20260803_020000.sql.gz --state-dir /var/lib/maisonnee
```

`restore_db.sh` refuses three things, each of which has a reason:

1. **It refuses to run without confirmation.** You retype the database name, or
   pass `--yes`. A `--force` you type by reflex protects nobody.
2. **It refuses to silently restore the database alone.** No matching
   `*_state.tar.gz`? Say `--db-only` and mean it.
3. **It refuses to start when the `vector` extension is unavailable** on the
   target, rather than failing halfway and leaving a partial database.

## How we know the format still round-trips

`scripts/test-backup-restore.sh` runs on every pull request and blocks every
release: it migrates a real schema, backs it up, restores it into a **fresh**
database, and asserts the table count, a marker row, the `vector` extension, the
secret key and an uploaded file all survived.

That test exists because a written restore procedure is true on the day it is
written. What makes it stop being true — an extension added to the schema, a
`pg_dump` option that changes meaning, a `psql` that exits 0 after failing —
never shows up in a re-reading. On the day it matters, you don't discover those
things: you suffer them.
