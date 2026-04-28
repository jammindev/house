# Module — build-and-deploy

> Audit : 2026-04-27. Rôle : chaîne de build (Vite + Django) et déploiement Docker + Traefik sur Mac Mini.

## État synthétique

- **Périmètre** : build frontend Vite (chunking manuel par vendor), image Docker multi-stage Node→Python, stack `docker-compose.prod.yml` + `docker-compose.staging.yml`, reverse proxy Nginx interne + Traefik externe, CI/CD GitHub Actions (lint/build/tests + deploy self-hosted), settings Django prod.
- **Health** : stable, en prod sur `house.jammin-dev.com` avec staging sur `staging.house.jammin-dev.com` (auto-deploy push `develop` → staging, push `main` → prod).

## Composition

- Build front : `ui/vite.config.ts` (manualChunks par vendor), `tsconfig.json`, `package.json` (scripts `dev`, `build`, `gen:api:refresh`, `lint`, `test:e2e`)
- Image : `Dockerfile` (stage `frontend` node:22-alpine → stage final python:3.12-slim), `docker-entrypoint.sh` (collectstatic + gunicorn 4 workers, timeout 60s)
- Stack : `docker-compose.prod.yml`, `docker-compose.staging.yml` (volumes séparés `*-staging`, project name `house-staging`)
- Reverse proxy : `nginx/default.conf` (gzip, security headers, CSP, `/media/` via Django `X-Accel-Redirect` → `/_protected_media/` `internal`)
- Traefik : labels dans le service `nginx` (entrypoints `http`/`https`, certresolver `le`, middleware `https-redirect@docker`)
- CI/CD : `.github/workflows/ci.yml` (jobs `backend`, `frontend`, `deploy`, `deploy-staging` sur runner self-hosted `jammindev`), `.github/workflows/claude.yml`, `claude-code-review.yml`
- Settings : `config/settings/production.py` (RuntimeError si `CORS_ALLOWED_ORIGINS` vide, HSTS, secure cookies, `SECURE_PROXY_SSL_HEADER`)
- Doc : `DEPLOYMENT.md`, `WORKFLOW.md`, `WORKFLOW_SETUP.md`
- Contexte infra : Mac Mini `192.168.1.76`, dossier `~/jammin-dev/apps/house/` et `~/jammin-dev/apps/house-staging/`, réseau Docker `traefik-public` partagé (cf. `~/.claude/CLAUDE.md` global)

## À corriger (urgent)

- [ ] CI/CD : aucun déploiement n'utilise `--build` flag explicite après `git reset --hard` côté staging — vérifier que `docker compose build` rebuilde bien l'image (workflow OK, mais pas de tag/version, ce qui complique les rollbacks)
- [ ] Pas de healthcheck sur le service `web` en prod — Docker ne sait pas si Gunicorn est réellement opérationnel — *source : `DEPLOYMENT.md` §9 "Priorité basse" (à promouvoir)*
- [ ] `DEPLOYMENT.md` §6 indique `cd ~/apps/house` alors que le runner CI utilise `~/jammin-dev/apps/house` — incohérence de chemin documenté vs réel — *source : `DEPLOYMENT.md` l. 370 vs `.github/workflows/ci.yml` l. 79*

## À faire (backlog)

- [ ] Mettre en place les backups automatiques PostgreSQL via crontab — *source : `DEPLOYMENT.md` §8 "Priorité haute"*
- [ ] Ajouter rotation des logs Docker (`/etc/docker/daemon.json` json-file max-size/max-file) — *source : `DEPLOYMENT.md` §9*
- [ ] Migrer Docker Desktop → Colima sur le Mac Mini (Docker Desktop nécessite session GUI ouverte, casse au reboot sans login auto) — *source : `~/.claude/CLAUDE.md` "Points d'amélioration"*
- [ ] Changer `FIRST_SUPERUSER_PASSWORD` dans les `.env` prod et staging du Mac Mini, relancer les containers — *source : `~/.claude/CLAUDE.md` "À faire rapidement"*
- [ ] Changer le mot de passe macOS du Mini (sudo exposé dans une conversation) — *source : `~/.claude/CLAUDE.md` "À faire rapidement"*

## À améliorer

- [ ] Tagger les images Docker par SHA git plutôt que `house:latest` pour permettre rollback rapide
- [ ] Ajouter un endpoint `/api/health/` Django pour brancher un healthcheck Compose — *source : `DEPLOYMENT.md` §9*
- [ ] Ajuster workers Gunicorn (4 actuellement, formule `2×CPU+1` → 4–6 raisonnable pour Mac Mini M2) — *source : `DEPLOYMENT.md` §9*
- [ ] Considérer le passage de `TIME_ZONE` à `Europe/Paris` pour l'admin — *source : `DEPLOYMENT.md` §9*
- [ ] Durcir la CSP Nginx (retirer `unsafe-inline` script/style avec un nonce) — *source : `docs/SECURITY_REVIEW.md` §9*
- [ ] Configurer Dependabot + lancer `pip audit` régulièrement — *source : `docs/SECURITY_REVIEW.md` "Bas"*

## Notes

- Le build frontend est inclus dans l'image Docker (multi-stage), pas publié séparément. `gen:api:refresh` requiert le serveur Django local sur `:8001`.
- Les fichiers `/media/` passent par Django (`serve_protected_media`) puis Nginx via `X-Accel-Redirect` (sécurité IDOR — `docs/SECURITY_REVIEW.md` §8 résolu).
- Le runner GitHub Actions est `self-hosted` org-level (`jammindev`), localisé sur le Mac Mini dans `~/jammin-dev/runners/org/`.
