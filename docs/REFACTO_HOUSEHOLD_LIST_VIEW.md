# Refacto : HouseholdListView — classe de base pour les vues liste

## Contexte

Dans toutes les vues liste du projet, on répète systématiquement le même
boilerplate pour résoudre le household sélectionné et filtrer la queryset :

```python
selected_household = _resolve_selected_household(request)
qs = MyModel.objects.for_user_households(request.user).filter(household=selected_household)
```

## Proposition

Créer une classe de base `HouseholdListView` qui :
- Hérite de `ListView` (pas de `TemplateView`) pour exploiter les hooks Django
  standards (`get_queryset()`, `model`, etc.)
- Encapsule le scoping household automatiquement
- Expose `self.selected_household` pour réutilisation dans `get_props()`

```python
class HouseholdListView(LoginRequiredMixin, ListView):
    def get_queryset(self):
        self.selected_household = _resolve_selected_household(self.request)
        return (
            super().get_queryset()
            .for_user_households(self.request.user)
            .filter(household=self.selected_household)
        )

    def get_props(self) -> dict:
        return {}

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["react_props"] = self.get_props()
        # ... (metadata Vite, IDs, etc.)
        return ctx
```

Chaque vue liste devient alors :

```python
class EquipmentListView(HouseholdListView):
    model = Equipment

    def get_props(self):
        return {
            'equipment': EquipmentListSerializer(self.get_queryset(), many=True).data,
            'selectedHousehold': self.selected_household.id,
        }
```

## Pourquoi ListView plutôt que TemplateView

- `get_queryset()` est le hook Django standard pour filtrer/ordonner
- `model = MyModel` suffit pour la queryset de base (DRY)
- S'intègre naturellement avec `django-filter` si besoin
- Code lisible pour tout dev Django

## Pourquoi garder get_props() et ne pas utiliser get_context_data()

`ReactPageView` (voir `apps/core/views.py`) utilise déjà `get_context_data()`
pour assembler le contexte template complet (metadata Vite, IDs des divs...).
Il appelle `self.get_props()` et place le résultat dans `react_props`.

`get_props()` est une séparation intentionnelle : il ne retourne que les données
React, pas le contexte Django. Il ne faut pas override `get_context_data()` dans
les sous-classes pour ne pas casser ce mécanisme.

## Analogie

C'est le pendant vue de `HouseholdScopedModel` :
- `HouseholdScopedModel` scope au niveau modèle (manager/queryset)
- `HouseholdListView` scope au niveau vue (queryset de la CBV)

## Fichiers concernés

- `apps/core/views.py` — à modifier pour y ajouter `HouseholdListView`
- Toutes les vues liste : `apps/*/views_web.py`
