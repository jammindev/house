# Install

## Requirements

Docker with the Compose plugin (`docker compose version` should print v2 or
later). Roughly 2 GB of RAM and 5 GB of disk to start. `amd64` and `arm64` are
both published, so a Raspberry Pi 4/5, an N100 box, or a Synology all work.

Nothing else. No Python, no Node, no `git clone`.

## Three lines

```bash
curl -O https://raw.githubusercontent.com/jammindev/house/main/docker-compose.yml
docker compose up
open http://localhost:8000
```

The first start pulls the image, creates the database, applies the schema, and
creates the first account — whose email and password are printed in a box in the
output. **Copy the password**: it is generated once and never shown again.

Run it in the background once you're satisfied it starts:

```bash
docker compose up -d
```

## What is running

| Service | Role |
|---|---|
| `db` | PostgreSQL 16 with the `vector` extension. Not published outside the compose network. |
| `init` | Runs once per start: waits for the database, migrates, creates the first account, exits. `web` waits for it to succeed. |
| `web` | The application, on port 8000. Serves its own static files and its own protected media — there is no Nginx in this stack. |
| `scheduler`, `scheduler-briefings` | Proactive reminders and briefings. Idle until someone schedules something. |

Two named volumes hold everything that matters: `postgres-data` and
`maisonnee-state`. See [backup-restore.md](backup-restore.md) before you have
anything worth losing.

## Optional settings

All have a working default. Put them in a `.env` file next to
`docker-compose.yml`:

| Variable | Default | What it does |
|---|---|---|
| `MAISONNEE_PORT` | `8000` | Port published on the host |
| `MAISONNEE_PUBLIC_URL` | — | The public address, if the instance has one. See below. |
| `MAISONNEE_ADMIN_EMAIL` | `admin@maisonnee.local` | First account's login |
| `MAISONNEE_ADMIN_PASSWORD` | generated | First account's password |
| `MAISONNEE_HOUSEHOLD_NAME` | — | Name of the household created on first start |
| `MAISONNEE_IMAGE` | `ghcr.io/jammindev/maisonnee:latest` | Pin a version — see [releases.md](releases.md) |
| `POSTGRES_PASSWORD` | `maisonnee` | Database password. Set it **before** the first start. |
| `GUNICORN_WORKERS` | `2` | Raise it on a machine that isn't a Pi |

The optional third-party keys — assistant, semantic search, email, push,
Telegram — live in the same file and have their own page:
[ai-providers.md](ai-providers.md).

## Putting it on the network

The stack serves **plain HTTP** on the published port, deliberately. TLS
terminates in whatever reverse proxy you already run.

### On your LAN only

Nothing to do. Reach it at `http://<machine>:8000`. Leave `MAISONNEE_PUBLIC_URL`
unset: the host list stays permissive, because a machine on a LAN is reached by
IP, by `.local` name, and by VPN name, and none of those are known in advance.

A VPN (Tailscale, WireGuard) is the cheapest way to reach your household from
outside without exposing anything.

### Behind a domain

Set `MAISONNEE_PUBLIC_URL` **and** point a reverse proxy at the published port.

```bash
# .env
MAISONNEE_PUBLIC_URL=https://maison.example.org
```

Declaring it does three things at once: cookies become `Secure`, HSTS switches
on, and the allowed-host list narrows to that single name. **The host list closes
at the exact moment the exposure widens** — which is the point, because nobody
remembers to tighten it afterwards.

Caddy, which gets you a certificate with no further configuration:

```
maison.example.org {
    reverse_proxy localhost:8000
}
```

Traefik, nginx or any other proxy work the same way. Two requirements:

- **Forward `X-Forwarded-Proto`.** Without it Django believes the request came in
  over plain HTTP. The stack deliberately does *not* redirect to HTTPS itself —
  your proxy already does, and a second redirect on a proxy that drops that header
  is an infinite loop. It is the classic self-hosting trap and it only shows up on
  the machine that hosts.
- **Don't buffer** if you use the assistant: its answers stream.

### Exposing it at all

Think about it before you do. This app holds bank statements and insurance
contracts. A VPN is not much less convenient than a public domain and removes
the whole question. If you do expose it, set `MAISONNEE_PUBLIC_URL`, keep the
image updated, and read [backup-restore.md](backup-restore.md) first rather than
after.

## Adding the rest of the household

Settings → *Households* → invite. This produces a **link you copy** — Maisonnée
sends no email unless you configured SMTP, and you do not need SMTP for this.
Whoever opens the link picks a password and lands in the household, with no
prior account. The link is valid for a week and can be revoked.

## Checking it is alive

```bash
curl -f http://localhost:8000/health/     # 200, no database query
docker compose ps                          # every service Up, db healthy
docker compose logs -f web
```

`/health/` is a proof of life, not of health: it deliberately touches no
database, so a database hiccup doesn't make the container report sick while it is
merely waiting.
