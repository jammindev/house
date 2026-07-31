# ─── Stage 1: Build React frontend ───────────────────────────────────────────
#
# `--platform=$BUILDPLATFORM` : cette étape tourne sur l'architecture de la
# MACHINE DE BUILD, jamais sur celle de l'image cible. Ce qu'elle produit — du
# JavaScript et du CSS — est identique sur amd64 et arm64, alors que la produire
# sous émulation qemu pour une image arm64 coûte des dizaines de minutes de
# `npm ci` et de bundling. Sans cette ligne, publier une image pour Raspberry Pi
# ferait tourner Node en émulation pour un résultat rigoureusement le même.
FROM --platform=$BUILDPLATFORM node:22-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ─── Stage 2: Python application ─────────────────────────────────────────────
FROM python:3.12-slim
WORKDIR /app

COPY requirements/base.txt requirements/base.txt
RUN pip install --no-cache-dir -r requirements/base.txt

COPY . .
# Écrase le dossier static/react vide (dev) par le build React compilé
COPY --from=frontend /app/static/react ./static/react

ENV DJANGO_SETTINGS_MODULE=config.settings.production

# `collectstatic` AU BUILD, plus au démarrage.
#
# Mesuré : ~0,4 s, donc ce n'est PAS le gros du 502 (issue #449) — le coupable
# était nginx et sa résolution DNS figée. Le déplacement se justifie autrement :
# le chemin de démarrage ne doit rien contenir d'autre que le lancement du
# serveur, et c'est ici que la recompression gzip/brotli atterrira le jour où le
# storage whitenoise sera réactivé (`STATICFILES_STORAGE` est ignoré depuis
# Django 5.1, qui l'a supprimé au profit de `STORAGES` — copier le même travail
# dans chaque démarrage de conteneur serait alors tout sauf gratuit).
#
# Les valeurs ci-dessous ne vivent que le temps de la commande : collectstatic ne
# se connecte à rien, il lui faut seulement une config qui s'importe — et
# `config.settings.production` exige ces quatre variables.
RUN SECRET_KEY=build-only \
    ALLOWED_HOSTS=localhost \
    CORS_ALLOWED_ORIGINS=http://localhost \
    DATABASE_URL=sqlite:///build-only.sqlite3 \
    python manage.py collectstatic --noinput

EXPOSE 8000

# Pas d'ENTRYPOINT : le CMD reste remplaçable, ce qui permet au deploy de lancer
# `compose run --rm web python manage.py migrate` sur l'image neuve — donc de
# migrer AVANT de basculer le trafic, au lieu de laisser le code neuf servir
# quelques secondes sur l'ancien schéma.
CMD ["gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "4", \
     "--timeout", "60", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
