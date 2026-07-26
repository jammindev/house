"""
Canonical registry of the app's navigation modules (parcours 15).

Mirrored by the frontend registry ``ui/src/lib/modules.ts`` — the keys MUST
stay identical on both sides. Two sets:

- ``OPTIONAL_MODULES``: modules a household owner can disable
  (``Household.disabled_modules``). Everything not listed here is core and
  always visible. Storing the *disabled* list means a newly shipped module is
  active by default for every existing household.
- ``PINNABLE_MODULES``: navigation entries a user can pin to the top of the
  sidebar (``User.pinned_modules``). Core-but-pinnable entries (tasks,
  projects…) are included; fixed-position entries (dashboard, agent, alerts,
  settings, admin) are not.
"""

OPTIONAL_MODULES = frozenset({
    'electricity',
    'water',
    'weather',
    'stock',
    'shopping',
    'chickens',
    'insurance',
    'trackers',
    'photos',
    'directory',
})

PINNABLE_MODULES = frozenset({
    # groupe Maison
    'zones',
    'equipment',
    'electricity',
    'water',
    'weather',
    'stock',
    'shopping',
    'chickens',
    'insurance',
    # groupe Suivi
    'tasks',
    'projects',
    'interactions',
    'trackers',
    'money',
    # groupe Ressources
    'documents',
    'photos',
    'directory',
})

#: Module keys the parcours 26 « Argent » shell replaced, kept only to migrate
#: stored user/household configuration. Nothing new must reference them: the three
#: pages became tabs of ``money``.
#:
#: Note that ``banking`` was **optional** while ``expenses`` and ``budget`` were
#: core. The merged key has to be core — a household cannot switch off ``money``
#: without losing expenses and budgets, which were never switchable. Assumed
#: consequence: bank accounts are no longer an opt-in, which is coherent with
#: « les relevés sont la source de vérité ».
LEGACY_MONEY_MODULES = frozenset({'banking', 'expenses', 'budget'})
