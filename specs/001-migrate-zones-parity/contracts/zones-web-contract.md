# Web UI Contracts — Zones Pages

## 1) `/app/zones/` (List/Tree page)

### SSR payload (`zones_page_props`)
```json
{
  "householdId": "uuid | null",
  "initialZones": [
    {
      "id": "uuid",
      "name": "string",
      "fullPath": "string",
      "color": "#RRGGBB",
      "parentId": "uuid | null"
    }
  ]
}
```

### React mount contract
- Mount point unique côté template (`react-root` ou équivalent page).
- Entrée React lit `zones_page_props` via `json_script`.
- UI legacy-like consomme `initialZones` avant tout fetch runtime.

### Runtime API interactions
- Read models:
  - list/tree via `/api/zones/` et `/api/zones/tree/`
  - children via `/api/zones/{id}/children/`
- Mutations:
  - create/update/delete via `/api/zones/` + `/api/zones/{id}/`
- Expected behavior:
  - delete parent with children => conflict + message explicite
  - stale update => conflict + message rechargement

## 2) `/app/zones/{id}` (Detail page)

### SSR payload (minimum attendu)
```json
{
  "householdId": "uuid | null",
  "zoneId": "uuid",
  "initialZone": {
    "id": "uuid",
    "name": "string",
    "parentId": "uuid | null",
    "note": "string",
    "surface": 0,
    "color": "#RRGGBB"
  },
  "initialStats": {
    "childrenCount": 0,
    "photosCount": 0
  },
  "initialPhotos": []
}
```

### React mount contract
- Entrée React détail dédiée.
- Fallback template lisible si JS indisponible.

### Runtime API interactions
- Zone read/update: `/api/zones/{id}/`
- Photos list: `/api/zones/{id}/photos/`
- Attach photo: `/api/zones/{id}/attach_photo/`

## 3) Adapter contract (DRF ↔ Legacy shape)

### DRF → Legacy (read)
- `parent` -> `parentId`
- `full_path` -> `fullPath`
- normalisation:
  - `note`: `null|undefined` -> `""`
  - `surface`: string/number -> number|null selon UI
  - `color`: défaut legacy si vide

### Legacy → DRF (write)
- `parentId` -> `parent`
- trim/normalisation champs textuels
- envoi `last_known_updated_at` pour update concurrent-safe

## 4) Household contract
- Toutes les requêtes sont résolues dans le household actif via les mécanismes existants (`X-Household-Id`, query param, auto-select membership unique).
- Les données hors household actif sont inaccessibles.
