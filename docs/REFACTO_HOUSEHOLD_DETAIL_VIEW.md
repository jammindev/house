# Refacto : HouseholdDetailView — classe de base pour les vues détail

## Contexte

Dans toutes les vues détail, on répète le même boilerplate pour récupérer
l'objet en vérifiant l'appartenance au household de l'utilisateur :

```python
# Pattern typique (ex: AppEquipmentDetailView)
def get_props(self):
    obj = get_object_or_404(
        MyModel.objects.for_user_households(self.request.user).select_related(...),
        id=self.kwargs["my_id"],
    )
    selected_household = _resolve_selected_household(self.request)
    ...

# Pattern avec cache manuel (ex: AppZoneDetailView)
def _fetch_zone(self):
    if not hasattr(self, '_zone_cache'):
        selected_household = _resolve_selected_household(self.request)
        queryset = Zone.objects.for_user_households(self.request.user)
        if selected_household:
            queryset = queryset.filter(household=selected_household)
        zone = queryset.filter(id=zone_id).first()
        ...
        self._zone_cache = zone
    return self._zone_cache
```

## Proposition

Créer une classe de base `HouseholdDetailView` qui :
- Hérite de `DetailView` pour exploiter les hooks Django standards
  (`get_object()`, `get_queryset()`, `pk_url_kwarg` / `slug_url_kwarg`, etc.)
- Encapsule le scoping household automatiquement
- Met l'objet en cache via le mécanisme natif Django (`self.object`)
- Expose `self.selected_household` pour réutilisation dans `get_props()`

```python
class HouseholdDetailView(LoginRequiredMixin, DetailView):
    def get_queryset(self):
        self.selected_household = _resolve_selected_household(self.request)
        qs = super().get_queryset().for_user_households(self.request.user)
        if self.selected_household:
            qs = qs.filter(household=self.selected_household)
        return qs

    def get_props(self) -> dict:
        return {}

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["react_props"] = self.get_props()
        # ... (metadata Vite, IDs, etc.)
        return ctx
```

Chaque vue détail devient alors :

```python
class AppEquipmentDetailView(HouseholdDetailView):
    model = Equipment
    pk_url_kwarg = "equipment_id"

    def get_queryset(self):
        return super().get_queryset().select_related("zone", "created_by", "updated_by")

    def get_props(self):
        equipment = self.object  # mis en cache par DetailView.get()
        return {
            "equipmentId": str(equipment.id),
            "editUrl": reverse("app_equipment_edit", kwargs={"equipment_id": equipment.id}),
            "listUrl": reverse("app_equipment"),
        }
```

## Avantages vs pattern actuel

| Actuel | Avec HouseholdDetailView |
|---|---|
| `get_object_or_404(...)` dans `get_props()` | `self.object` (mis en cache par Django) |
| Cache manuel avec `_fetch_zone` / `hasattr` | Cache natif via `self.object` |
| `for_user_households()` répété partout | Centralisé dans `get_queryset()` |
| 404 géré manuellement | `get_object()` lève `Http404` automatiquement |

## Pourquoi DetailView plutôt que TemplateView

- `get_object()` gère le 404 et le cache automatiquement
- `pk_url_kwarg` / `slug_url_kwarg` configurables par attribut de classe
- `get_queryset()` est le hook standard pour ajouter `select_related`, filtres, etc.
- `self.object` disponible dans `get_props()` et `get_context_data()` sans re-requête

## Analogie avec HouseholdListView

- `HouseholdListView` (voir `docs/REFACTO_HOUSEHOLD_LIST_VIEW.md`) scope la queryset liste
- `HouseholdDetailView` scope la queryset détail avec récupération d'objet unique

Les deux sont le pendant vue de `HouseholdScopedModel` (scope modèle).

## Fichiers concernés

- `apps/core/views.py` — à modifier pour y ajouter `HouseholdDetailView`
- Toutes les vues détail : `apps/*/views_web.py`
  - `AppEquipmentDetailView`, `AppEquipmentEditView` (`apps/equipment/views_web.py`)
  - `AppZoneDetailView` (`apps/zones/views_web.py`) — supprime le `_fetch_zone` cache manuel
  - `AppStockDetailView` (`apps/stock/views_web.py`)
  - `AppContactDetailView`, `AppStructureDetailView` (`apps/directory/views_web.py`)
  - `AppDocumentDetailView` (`apps/documents/views_web.py`)
  - `AppProjectsDetailView`, `AppProjectGroupDetailView` (`apps/projects/views_web.py`)
