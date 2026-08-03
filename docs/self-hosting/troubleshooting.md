# Troubleshooting

Start here, always:

```bash
docker compose ps            # which service is not Up
docker compose logs --tail=100 init
docker compose logs --tail=100 web
```

`init` runs first and `web` waits for it. If something is wrong at startup, the
answer is almost always in `init`'s log, not `web`'s.

---

## It doesn't start

**`web` never comes up, `init` exited non-zero.** Read `docker compose logs
init`. The usual causes: the database volume belongs to a different PostgreSQL
major (see [upgrade.md](upgrade.md)), the disk is full, or a migration failed. A
failed migration leaves `web` on the previous container rather than serving a
half-migrated schema — that is the intended behaviour, not a deadlock.

**`db` restarts in a loop.** Almost always a `POSTGRES_PASSWORD` changed *after*
the first start. The password is baked into the data directory at
initialisation; changing the variable afterwards doesn't change it, it just stops
matching. Either put the original value back, or start over from a backup.

**`exec format error`.** You are on `arm64` and pulled an `amd64`-only image.
Every release publishes both — `docker compose pull` again, and check
`MAISONNEE_IMAGE` isn't pinned to something old.

**`denied` when pulling.** See the last section of [releases.md](releases.md);
it is a package-visibility issue, not something on your side.

---

## I can't reach it

**Nothing on `:8000`.** `docker compose ps` — is `web` actually up? Is
`MAISONNEE_PORT` set to something else? Is another process already on that port?

**`DisallowedHost` / 400 with a domain.** You set `MAISONNEE_PUBLIC_URL` and are
reaching the instance by a *different* name (its IP, its `.local` name). That is
the setting working as intended: declaring a public URL narrows the allowed hosts
to that name. Reach it by that name, or unset the variable if the instance is not
actually public.

**Redirect loop over HTTPS.** Your reverse proxy is not forwarding
`X-Forwarded-Proto`. Django then believes the request arrived in plain HTTP.
Fix the proxy — the stack deliberately does not redirect to HTTPS itself
precisely so that this loop cannot be created from two sides at once.

**Logged out at every restart.** The `maisonnee-state` volume is not persisting,
so a new secret key is generated each time. Check `docker volume ls` and that
you have not been running with `--rm` or recreating the volume.

---

## It behaves oddly

**The assistant answers "not configured".** It is not broken; the instance has
no provider key. Settings → *What this instance can do* lists every optional
capability and links to [ai-providers.md](ai-providers.md).

**Search finds nothing by meaning.** Same thing: semantic search is off unless
both a key and `AGENT_HYBRID_RETRIEVAL_ENABLED` are set — and the flag should
only go on after `backfill_embeddings` has run. A half-filled index searches,
finds nothing, and never says it only looked at part of your household.

**A document 404s.** The `maisonnee-state` volume and the database disagree:
usually a database restored without its matching state archive. That is the
failure [backup-restore.md](backup-restore.md) exists to prevent, and the way out
is to restore the matching `*_state.tar.gz`.

**Invitations go nowhere.** Expected without SMTP. Invitations produce a **link
you copy** — the email is a convenience, never the only route in.

---

## It's slow

**On a Pi.** `GUNICORN_WORKERS=2` is the default because this stack has to fit on
one. On anything larger, raise it. Uploading and OCR are the heavy paths.

**Everything is slow at once.** Check disk space (`df -h`) and the database
volume's size. PostgreSQL degrades sharply on a full disk.

---

## Getting the logs someone can read

```bash
docker compose logs --tail=200 > maisonnee-logs.txt
docker compose ps >> maisonnee-logs.txt
docker version >> maisonnee-logs.txt
```

Then open an issue. **Read the file before attaching it** — logs from your own
instance can contain household names, email addresses and file names.
