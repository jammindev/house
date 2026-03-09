# OpenAPI -> TypeScript client (DRF)

Ce projet génère un client API TypeScript depuis le schéma OpenAPI exposé par Django REST Framework.

## Prérequis

- Environnement Python installé (`pip install -r requirements.txt`)
- Environnement Node installé (`npm install`)
- Backend Django démarré en local sur `http://127.0.0.1:8001`

## Endpoints OpenAPI (dev uniquement)

- Schéma JSON: `/api/schema/`
- Swagger UI: `/api/schema/swagger/`
- Redoc: `/api/schema/redoc/`

Ces routes sont activées seulement quand `ENABLE_API_SCHEMA=True` (local).

## Génération du client TS

Depuis la racine du repo:

```bash
npm run gen:api
```

Sortie générée:

- `ui/src/gen/api`

Rafraîchir complètement:

```bash
npm run gen:api:refresh
```

## Intégration progressive

Le code existant dans `ui/src/lib/api/*` reste valide.

Recommandation de migration:

1. Choisir un domaine pilote (ex: zones)
2. Remplacer les appels manuels `fetch` par les services générés
3. Garder le header household `X-Household-Id` dans les appels concernés
4. Étendre module par module
