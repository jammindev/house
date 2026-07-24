---
name: infra
description: Accéder à l'infra serveur de prod (VPS OVH) — SSH, conteneurs Docker, base PostgreSQL, logs, migrations, dumps. Utiliser quand l'utilisateur veut se connecter au VPS, inspecter/requêter la base de prod, lire les logs d'un service, relancer un conteneur, exécuter une commande manage.py en prod, ou comprendre le déploiement.
allowed-tools: Bash, Read
---

# Infra — accéder au serveur de prod

Tout ce qui touche au serveur de prod de `house` : accès VPS, conteneurs Docker,
base PostgreSQL, logs, déploiement. Doc complète de l'infra : sur le VPS dans
`~/jammin-dev/CLAUDE.md` (le lire avant toute action non-triviale sur l'infra).

> ⚠️ **Prod = données réelles.** Par défaut, tout est **lecture seule**. Toute
> écriture (UPDATE/DELETE SQL, migration, restart, `up -d`) doit être confirmée
> explicitement par l'utilisateur avant exécution. Ne jamais `DROP`, `TRUNCATE`,
> ni éditer la base sans demande explicite.

## Repères

| Ressource | Valeur |
|---|---|
| VPS | OVH — Debian 13 (trixie) |
| IP | `51.75.28.192` |
| SSH | `ssh -p 2244 hermes@51.75.28.192` |
| App house | `~/jammin-dev/apps/house/` (sur le VPS) |
| Domaine | `house.jammin-dev.com` |
| Compose | `docker-compose.prod.yml` |
| Services Docker | `db`, `web`, `scheduler`, `nginx` |
| DB | PostgreSQL 16 + pgvector — base `house`, user `house_user` |
| Docker | `/usr/local/bin/docker` (chemin absolu utilisé par le runner) |

Le déploiement est automatique : push sur `main` → runner self-hosted →
`git reset --hard origin/main` + `docker compose build` + `up -d` + `migrate`
(voir `.github/workflows/ci.yml`, job `deploy`). **Ne jamais déployer à la main
sauf demande explicite** — laisser la CI faire.

## Se connecter

```bash
ssh -p 2244 hermes@51.75.28.192
```

Depuis le Mac, pour lancer une commande one-shot sans session interactive, préfixer :

```bash
ssh -p 2244 hermes@51.75.28.192 '<commande>'
```

> Un login interactif (mot de passe, MFA) doit être lancé par l'utilisateur via
> `! ssh -p 2244 hermes@51.75.28.192` dans le prompt.

Toutes les commandes Docker/DB ci-dessous se lancent **depuis** `~/jammin-dev/apps/house`
sur le VPS. En one-shot depuis le Mac, enrober :

```bash
ssh -p 2244 hermes@51.75.28.192 'cd ~/jammin-dev/apps/house && <commande>'
```

Alias utilisé partout ci-dessous : `dc="/usr/local/bin/docker compose -f docker-compose.prod.yml"`.

## État des conteneurs

```bash
cd ~/jammin-dev/apps/house
/usr/local/bin/docker compose -f docker-compose.prod.yml ps
```

## Logs

```bash
# Suivre les logs du web (Ctrl-C pour quitter)
/usr/local/bin/docker compose -f docker-compose.prod.yml logs -f web

# 200 dernières lignes d'un service
/usr/local/bin/docker compose -f docker-compose.prod.yml logs --tail=200 web
/usr/local/bin/docker compose -f docker-compose.prod.yml logs --tail=200 scheduler
/usr/local/bin/docker compose -f docker-compose.prod.yml logs --tail=200 db
```

En one-shot (ne pas utiliser `-f`, ça ne rend jamais la main) :

```bash
ssh -p 2244 hermes@51.75.28.192 \
  'cd ~/jammin-dev/apps/house && /usr/local/bin/docker compose -f docker-compose.prod.yml logs --tail=200 web'
```

## Accéder à la base (données en prod)

### Shell Django (le plus sûr — respecte les managers/scopes)

```bash
/usr/local/bin/docker compose -f docker-compose.prod.yml exec web python manage.py shell
```

Pour une requête one-shot :

```bash
/usr/local/bin/docker compose -f docker-compose.prod.yml exec -T web \
  python manage.py shell -c "from accounts.models import User; print(User.objects.count())"
```

### psql direct

Le mot de passe n'est pas nécessaire depuis le conteneur `db` (auth locale) :

```bash
/usr/local/bin/docker compose -f docker-compose.prod.yml exec db \
  psql -U house_user -d house
```

Requête one-shot en lecture (safe) :

```bash
/usr/local/bin/docker compose -f docker-compose.prod.yml exec -T db \
  psql -U house_user -d house -c "SELECT id, email FROM accounts_user LIMIT 20;"
```

Lister les tables :

```bash
/usr/local/bin/docker compose -f docker-compose.prod.yml exec -T db \
  psql -U house_user -d house -c "\dt"
```

### Dump / sauvegarde

```bash
# Dump compressé, horodaté (à faire tourner AVANT toute opération risquée)
/usr/local/bin/docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U house_user -d house | gzip > ~/house-$(date +%F-%H%M).sql.gz

# Rapatrier le dump sur le Mac
scp -P 2244 hermes@51.75.28.192:~/house-*.sql.gz .
```

## Commandes manage.py en prod

Format : `dc exec web python manage.py <cmd>`. Exemples utiles :

```bash
# Migrations (normalement jouées par la CI — le faire à la main uniquement si demandé)
/usr/local/bin/docker compose -f docker-compose.prod.yml exec web python manage.py migrate

# Vérifier l'état des migrations
/usr/local/bin/docker compose -f docker-compose.prod.yml exec -T web python manage.py showmigrations

# Créer un superuser
/usr/local/bin/docker compose -f docker-compose.prod.yml exec web python manage.py createsuperuser

# Changelog / autres commandes projet
/usr/local/bin/docker compose -f docker-compose.prod.yml exec -T web python manage.py generate_changelog
```

## Redémarrer / rebuild (⚠️ confirmer avant)

```bash
# Redémarrer un service (sans rebuild)
/usr/local/bin/docker compose -f docker-compose.prod.yml restart web

# Rebuild + up (ce que fait la CI — préférer laisser la CI le faire)
/usr/local/bin/docker compose -f docker-compose.prod.yml build
/usr/local/bin/docker compose -f docker-compose.prod.yml up -d
```

## Traefik (reverse proxy partagé)

Géré à part depuis `~/jammin-dev/infra/`. Le service `nginx` de house porte les
labels Traefik (routers `house-http`/`house-https`, réseau `traefik-public`,
certresolver `le`). En cas de souci HTTPS/routing, voir `~/jammin-dev/CLAUDE.md`
et les logs Traefik dans `~/jammin-dev/infra/`.

## Garde-fous

- **Lecture par défaut, écriture sur confirmation.** Annoncer toute commande qui
  modifie l'état (SQL non-SELECT, migrate, restart, build/up, dump→restore).
- **Dump avant toute opération risquée** sur la base.
- **Ne pas déployer à la main** : `git push` sur `main` suffit (CI auto-deploy).
- Ne jamais coller de secrets (`.env`, `POSTGRES_PASSWORD`, tokens) dans la
  conversation ni dans un commit.
- `logs -f` / `shell` / `psql` interactif : ne jamais les lancer en one-shot SSH
  non-tty (n'y a pas de main rendue). Utiliser `--tail`, `-c`, `shell -c`.
