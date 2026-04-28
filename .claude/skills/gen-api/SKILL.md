---
name: gen-api
description: Régénère les types TypeScript de l'API depuis le schéma OpenAPI Django. Utiliser quand un modèle/serializer/viewset backend a été modifié et que le frontend doit consommer les nouveaux types. Requiert que le serveur Django tourne sur :8001.
allowed-tools: Bash, Read
---

## Procédure

1. Vérifier que le serveur Django tourne sur `127.0.0.1:8001` :
   ```bash
   curl -sf http://127.0.0.1:8001/api/schema/ -o /dev/null && echo OK || echo "Django not running on :8001"
   ```
   Si KO : demander à l'utilisateur de le démarrer (`source venv/bin/activate && python manage.py runserver`) ou utiliser le skill `/dev` qui fait les deux.

2. Régénérer les types :
   ```bash
   npm run gen:api:refresh
   ```

3. Vérifier le diff sur `ui/src/gen/api/` :
   ```bash
   git diff --stat ui/src/gen/api/
   ```

4. Si des changements :
   - Si nouveaux endpoints/modèles → confirmer à l'utilisateur que les types sont à jour
   - Si erreur de génération → regarder la sortie de la commande, corriger côté backend (souvent un serializer mal annoté)

5. Lancer un type-check rapide :
   ```bash
   cd ui && npx tsc --noEmit 2>&1 | head -20
   ```

## Notes

- Le schéma OpenAPI est généré par `drf-spectacular` (`/api/schema/`).
- `ENABLE_API_SCHEMA=True` est requis dans le settings actif.
- Ne **jamais** éditer manuellement `ui/src/gen/api/` — c'est généré.
- Si on touche à un serializer, il est conseillé de relancer ce skill puis vérifier que le frontend compile.
