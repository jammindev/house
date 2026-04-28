# Module — build-and-deploy

> Audit : 2026-04-28. Rôle : chaîne de build (Vite + Django) et déploiement Docker + Traefik sur Mac Mini.

## État synthétique

- **Périmètre** : build frontend Vite (chunking manuel par vendor), image Docker multi-stage Node→Python, stack `docker-compose.prod.yml`, reverse proxy Nginx interne + Traefik externe, CI/CD GitHub Actions (lint/build/tests + deploy self-hosted), settings Django prod.
- **Health** : stable, en prod sur `house.jammin-dev.com` (auto-deploy push `main` → prod). Trunk-based depuis 2026-04-28, plus de staging.

## Composition

- Build front : `ui/vite.config.ts` (manualChunks par vendor), `tsconfig.json`, `package.json` (scripts `dev`, `build`, `gen:api:refresh`, `lint`, `test:e2e`)
- Image : `Dockerfile` (stage `frontend` node:22-alpine → stage final python:3.12-slim), `docker-entrypoint.sh` (collectstatic + gunicorn 4 workers, timeout 60s)
- Stack : `docker-compose.prod.yml`
- Reverse proxy : `nginx/default.conf` (gzip, security headers, CSP, `/media/` via Django `X-Accel-Redirect` → `/_protected_media/` `internal`)
- Traefik : labels dans le service `nginx` (entrypoints `http`/`https`, certresolver `le`, middleware `https-redirect@docker`)
- CI/CD : `.github/workflows/ci.yml` (jobs `backend`, `frontend`, `deploy` sur runner self-hosted `jammindev`), `.github/workflows/claude.yml`, `claude-code-review.yml`
- Settings : `config/settings/production.py` (RuntimeError si `CORS_ALLOWED_ORIGINS` vide, HSTS, secure cookies, `SECURE_PROXY_SSL_HEADER`)
- Doc : `DEPLOYMENT.md`, `WORKFLOW.md`
- Contexte infra : Mac Mini `192.168.1.76`, dossier `~/jammin-dev/apps/house/`, réseau Docker `traefik-public` partagé (cf. `~/.claude/CLAUDE.md` global)

## Notes

- Le build frontend est inclus dans l'image Docker (multi-stage), pas publié séparément. `gen:api:refresh` requiert le serveur Django local sur `:8001`.
- Les fichiers `/media/` passent par Django (`serve_protected_media`) puis Nginx via `X-Accel-Redirect` — permission check côté Django avant délégation Nginx (protection IDOR).
- Le runner GitHub Actions est `self-hosted` org-level (`jammindev`), localisé sur le Mac Mini dans `~/jammin-dev/runners/org/`.
