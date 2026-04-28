---
name: dev
description: Démarre le stack de développement local — serveur Django (port 8001) + serveur Vite (port 5174) — en arrière-plan, et affiche les URLs utiles. Utiliser au début d'une session de dev.
allowed-tools: Bash, Read
---

## Procédure

1. Vérifier qu'aucune instance ne tourne déjà :
   ```bash
   lsof -nP -i:8001 -i:5174 2>/dev/null | grep LISTEN || echo "ports libres"
   ```

2. Démarrer Django (port 8001) en arrière-plan, log dans `/tmp/house-django.log` :
   ```bash
   source venv/bin/activate && python manage.py runserver 127.0.0.1:8001 > /tmp/house-django.log 2>&1 &
   ```
   Lance ce step via `Bash` avec `run_in_background=true`.

3. Démarrer Vite (port 5174) en arrière-plan, log dans `/tmp/house-vite.log` :
   ```bash
   npm run dev > /tmp/house-vite.log 2>&1 &
   ```
   Lance ce step via `Bash` avec `run_in_background=true`.

4. Attendre quelques secondes puis vérifier la santé :
   ```bash
   sleep 4 && curl -sf http://127.0.0.1:8001/api/schema/ -o /dev/null && echo "Django OK" || echo "Django KO — voir /tmp/house-django.log"
   curl -sf http://127.0.0.1:5174/ -o /dev/null && echo "Vite OK" || echo "Vite KO — voir /tmp/house-vite.log"
   ```

5. Afficher à l'utilisateur :
   - **Frontend SPA** : http://127.0.0.1:8001/app/ (servi par Django, charge les bundles Vite via django-vite)
   - **Vite dev server** : http://127.0.0.1:5174/ (HMR direct, optionnel)
   - **Django admin** : http://127.0.0.1:8001/admin/
   - **API schema** : http://127.0.0.1:8001/api/schema/swagger/
   - **Logs** : `/tmp/house-django.log`, `/tmp/house-vite.log`

## Comptes demo (après `python manage.py seed_demo_data`)

- Email : `claire.mercier@demo.local`
- Mot de passe : `demo1234`

## Notes

- Si l'utilisateur veut juste régénérer les types API : utiliser `/gen-api`.
- Pour stopper : `pkill -f "manage.py runserver" ; pkill -f "vite"`.
