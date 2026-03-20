# ─── Stage 1: Build React frontend ───────────────────────────────────────────
FROM node:22-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ─── Stage 2: Python application ─────────────────────────────────────────────
FROM python:3.12-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
# Écrase le dossier static/react vide (dev) par le build React compilé
COPY --from=frontend /app/static/react ./static/react

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["/docker-entrypoint.sh"]
