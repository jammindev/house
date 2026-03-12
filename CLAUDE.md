# House — règles de développement

## Architecture Django + React

Ce projet utilise un pattern hybride : Django sert les templates, React prend le relais via DRF.

### Règle fondamentale : Django ne sert PAS de données modèle

`views_web.py` transmet uniquement du **contexte minimal** :

```python
# ✅ Autorisé dans get_props()
{
    "householdId": str(...),   # ID pour scoper les appels API côté React
    "itemId": str(...),         # ID d'une ressource pour une page detail
    "route": "list",            # Discriminant de route SPA
    "routeData": {},            # Données de routage non-modèle
    "cancelUrl": reverse(...),  # URLs générées par Django
    "createUrl": reverse(...),
    "defaultType": "note",      # Valeurs GET / config statique
    "title": str(_("...")),     # Traductions à passer si nécessaire
    "sourceDocument": {...},    # ✅ Préfill léger d'une seule ressource (pas de liste)
}

# ❌ Interdit dans get_props()
{
    "initialItems": SomeSerializer(queryset, many=True).data,   # liste
    "initialZones": ZonePickerSerializer(zones, many=True).data, # liste
    "initialCategories": ...,                                    # liste
    "initialLoaded": True,                                       # flag de chargement
    "initialCount": qs.count(),                                  # compteur DB
}
```

**React fetch toujours depuis DRF au montage du composant.** Jamais de seeding depuis les props initiales.

### Pattern views_web.py

```python
from core.views import ReactPageView

class AppXxxView(ReactPageView):
    react_root_id = "xxx-root"
    props_script_id = "xxx-props"
    page_vite_asset = "src/pages/xxx/list.tsx"

    def get_props(self):
        return {
            # IDs, URLs, config — pas de querysets
        }
```

- Toujours `ReactPageView` (jamais `HouseholdListView` sauf si la liste est rendue côté Django)
- Pas de `get_queryset()` sauf si absolument nécessaire pour d'autres raisons
- Pas d'imports de serializers dans `views_web.py` (sauf pour les préfills mono-instance)

### Pattern React

```tsx
export default function MyPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchItems().then(setItems).finally(() => setLoading(false));
  }, []);
  // ...
}
```

- `loading` démarre à `true` — le skeleton s'affiche toujours au premier rendu
- Pas de `initialItems` dans les props du composant
- Pas de pattern `hasServerData` / `isFirstRender`

### Serializers

- **Un seul serializer par ressource** : le serializer DRF API
- Pas de `*PropsSerializer` ou `*ListPropsSerializer`
- Les serializers `*PickerSerializer` ne doivent pas exister — utiliser le serializer principal ou un endpoint dédié
- Les picker forms (zone picker, category picker) fetchent depuis l'API au montage

### Tests web views

Les tests `views_web.py` vérifient uniquement la présence du **contexte minimal** :

```python
props = response.context['react_props']
assert props['itemId'] == str(item.id)
assert props['cancelUrl'] == reverse('app_xxx')
assert 'initialItems' not in props   # toujours vérifier l'absence de données modèle
```

### Household scoping — middleware first

Les appels API React ne passent **pas** de `householdId` dans l'URL ou les params.
Le middleware `ActiveHouseholdMiddleware` scope automatiquement chaque requête via `request.household`.

```typescript
// ✅ Correct — scopé par le middleware
fetch('/api/tasks/tasks/')
fetch('/api/zones/')
fetch('/api/households/active-members/')

// ❌ Incorrect — ne pas passer l'ID manuellement
fetch(`/api/households/${householdId}/members/`)
```

Exception : les endpoints DRF `detail=True` nécessitent un `pk` (ex: `/api/tasks/tasks/{id}/`). C'est normal.
Pour les actions de liste scoped household, toujours utiliser `detail=False` + `request.household` dans le ViewSet.

### Fichiers de référence

- `apps/tasks/views_web.py` — exemple le plus simple
- `apps/zones/views_web.py` — exemple avec détail (zoneId + URLs)
- `apps/projects/views_web.py` — exemple SPA multi-routes
- `apps/tasks/react/TasksPage.tsx` — exemple React fetch-on-mount
- `apps/projects/react/ProjectForm.tsx` — exemple fetch groups + zones au montage
