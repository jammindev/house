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
    # groupe Argent — trois pages, plus un module à onglets (issue #562)
    'money_budgets',
    'money_expenses',
    'money_accounts',
    # groupe Ressources
    'documents',
    'photos',
    'directory',
})

#: Module keys the money navigation went through, kept only to migrate stored
#: user/household configuration. Nothing new must reference them.
#:
#: ``banking``/``expenses``/``budget`` were the three pages of parcours 26 lot 2,
#: folded into a single ``money`` entry; ``money`` itself was then split back into
#: the three ``money_*`` pages of a sidebar group (issue #562). Note that
#: ``banking`` was **optional** while the other two were core: the whole family is
#: core now, which is coherent with « les relevés sont la source de vérité » —
#: a household cannot switch off expenses and budgets, which were never switchable.
LEGACY_MONEY_MODULES = frozenset({'banking', 'expenses', 'budget', 'money'})
