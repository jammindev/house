"""Parcours du routeur DRF réel — le socle des contrôles génériques.

Deux garde-fous s'appuient dessus, et ils protègent des choses différentes :

- ``core/tests/test_tenant_isolation.py`` — aucune vue ne sert au-delà de son
  foyer ;
- ``core/tests/test_rate_limits.py`` — aucune vue ne sert sans plafond de débit.

Le code vit **ici**, dans l'app, plutôt que dans l'un des deux fichiers de test,
pour une raison qui est la règle générale du projet : deux parcours du routeur
écrits séparément divergeraient, et le plus ancien finirait par passer au vert en
n'inspectant plus rien — exactement le défaut que le n°2 de
``test_tenant_isolation`` décrit (« un contrôle qui ne contrôle plus ressemble à
une absence d'écart »). Un seul parcours, deux lectures.

Il ne pouvait pas non plus s'importer d'un test à l'autre : ``apps/core/tests``
n'est pas un paquet, et ne peut pas le devenir tant que ``apps/core/tests.py``
existe à côté — même situation dans ``documents``, ``households`` et ``zones``.
"""
from django.urls import URLPattern, URLResolver, get_resolver


def registered_api_views():
    """Toutes les classes de vue montées sous ``/api/``, depuis le routeur réel.

    Retourne ``{classe: chemin}``. Le filtre sur ``api/`` écarte l'admin et les
    gabarits Django, qui ne relèvent d'aucun des deux contrôles.
    """
    found = {}

    def walk(resolver, prefix=""):
        for pattern in resolver.url_patterns:
            if isinstance(pattern, URLResolver):
                walk(pattern, prefix + str(pattern.pattern))
            elif isinstance(pattern, URLPattern):
                cls = getattr(pattern.callback, "cls", None)
                if cls is not None:
                    found.setdefault(cls, prefix + str(pattern.pattern))

    walk(get_resolver())
    return {cls: path for cls, path in found.items() if path.startswith("api/")}


def dotted(cls):
    """``module.Classe`` — la forme lisible dans un message d'échec."""
    return f"{cls.__module__}.{cls.__name__}"
