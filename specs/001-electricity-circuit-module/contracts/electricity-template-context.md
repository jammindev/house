# UI Contract — Django Template Context (`templates/app/electricity.html`)

## View
- Route HTML cible: `/app/electricity/`
- Vue Django: `electricity.views.app_electricity_view`

## Context keys (server-rendered)

### `electricity_page_props`
Objet JSON sérialisé injecté dans le template et transmis au nœud React si présent.

```json
{
  "householdId": "uuid",
  "isOwner": true,
  "board": {
    "id": "uuid",
    "name": "Tableau principal",
    "supplyType": "three_phase"
  },
  "summary": {
    "circuitsCount": 12,
    "breakersCount": 14,
    "usagePointsCount": 38,
    "activeLinksCount": 38
  },
  "initialLookup": [],
  "apiBase": "/api/electricity/"
}
```

### `server_sections`
Structure SSR affichée sans JS:
- `circuits`
- `breakers`
- `rcds`
- `usage_points`
- `recent_changes`

## Rendering rules
- Le template DOIT afficher un fallback lisible sans JavaScript.
- Le nœud React est monté uniquement sur le bloc “mapping interactif” et lit ses props depuis `electricity_page_props`.
- Les actions d’édition sont cachées côté template si `isOwner=false` et protégées côté API.
