# Upgrading

```bash
docker compose pull
docker compose up -d
```

That is the whole procedure. The `init` service runs before `web` is allowed to
start: it applies the migrations, and `web` waits for it to succeed. The server
therefore never serves on a schema it has not migrated — which is what makes
`pull && up -d` safe rather than hopeful.

**Back up first.** Not because upgrades usually go wrong, but because a
migration is the one operation that changes your data in a way you cannot undo by
restarting. See [backup-restore.md](backup-restore.md).

## Watching it land

```bash
docker compose logs -f init     # migrations
docker compose ps               # web healthy again
curl -f http://localhost:8000/health/
```

If `init` fails, `web` does not start — you keep the previous container until you
fix it. That is deliberate: a half-migrated instance that serves is worse than an
instance that doesn't.

## The compatibility promise

Once other people run this, nobody controls when they update. So:

> **A destructive schema change ships in two releases.** A column is never
> dropped or renamed in the same version that stops using it.

Release *n* stops writing the column and starts writing its replacement; release
*n+1*, at the earliest, drops it. The reason is mechanical: during any upgrade
there is a moment where the **old code sees the new schema**, and a column that
vanished in that moment is a 500 for everyone who was mid-request.

This started as an internal deploy rule — the author's production migrates on a
disposable container before switching traffic. Distributing an image promotes it
to a public promise, because the window is no longer minutes on one machine but
however long strangers take to run `pull`.

Practically, for you: **skipping versions is safe**, and going backwards is not.

## Rolling back

The image is versioned; your data is not. Pin the previous image and restart:

```bash
# .env
MAISONNEE_IMAGE=ghcr.io/jammindev/maisonnee:0.1.0
```

```bash
docker compose up -d
```

This works when the release you are leaving applied no migration, or an additive
one. It does **not** work across a destructive one: the older code will meet
tables it does not know how to read. In that case, restore the backup you took
before upgrading — which is the second reason to take it.

Release notes say when a version contains a migration. See [releases.md](releases.md).

## Upgrading PostgreSQL

The database image is pinned to `pgvector/pgvector:pg16`. Don't bump the major
version by editing the tag: PostgreSQL does not read a newer major's data
directory, and the container will refuse to start on a directory it considers
foreign. The migration path is dump → new volume → restore, and it is exactly the
procedure in [backup-restore.md](backup-restore.md). When a major bump becomes
worthwhile it will come with its own release note.
