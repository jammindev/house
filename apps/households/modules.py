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
    'chickens',
    'insurance',
    # groupe Suivi
    'tasks',
    'projects',
    'interactions',
    'trackers',
    'expenses',
    # groupe Ressources
    'documents',
    'photos',
    'directory',
})
