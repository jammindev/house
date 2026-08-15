"""Tests for the searchable entities registry."""
from __future__ import annotations

import pytest

from agent.searchables import (
    REGISTRY,
    SearchableSpec,
    find_spec,
    find_spec_for_instance,
    register,
    reset_registry,
)


EXPECTED_ENTITY_TYPES = {
    "document",
    "interaction",
    "equipment",
    "task",
    "project",
    "zone",
    "stock_item",
    "insurance_contract",
    "contact",
    "structure",
}


@pytest.fixture
def empty_registry():
    """Snapshot/restore the registry so individual tests don't pollute the global state."""
    snapshot = list(REGISTRY)
    reset_registry()
    yield
    reset_registry()
    REGISTRY.extend(snapshot)


def _spec(entity_type: str = "dummy", **overrides) -> SearchableSpec:
    from documents.models import Document

    defaults = dict(
        entity_type=entity_type,
        model=Document,
        search_fields=("name",),
        label_attr="name",
        url_template="/dummy/{id}",
    )
    defaults.update(overrides)
    return SearchableSpec(**defaults)


class TestRegister:
    def test_register_adds_spec(self, empty_registry):
        spec = _spec("dummy")
        register(spec)
        assert spec in REGISTRY
        assert len(REGISTRY) == 1

    def test_double_register_same_entity_type_raises(self, empty_registry):
        register(_spec("dummy"))
        with pytest.raises(ValueError, match="already registered"):
            register(_spec("dummy"))

    def test_distinct_entity_types_coexist(self, empty_registry):
        register(_spec("dummy_a"))
        register(_spec("dummy_b"))
        assert {s.entity_type for s in REGISTRY} == {"dummy_a", "dummy_b"}


class TestFindSpec:
    def test_returns_matching_spec(self, empty_registry):
        spec = _spec("dummy")
        register(spec)
        assert find_spec("dummy") is spec

    def test_returns_none_for_unknown(self, empty_registry):
        assert find_spec("nope") is None


class TestFindSpecForInstance:
    def test_matches_instance_by_model(self, empty_registry, db):
        from documents.models import Document

        spec = _spec("document", model=Document)
        register(spec)
        doc = Document(name="x")
        assert find_spec_for_instance(doc) is spec

    def test_returns_none_for_unregistered_model(self, empty_registry, db):
        from zones.models import Zone

        register(_spec("document"))  # only Document registered
        assert find_spec_for_instance(Zone(name="z")) is None


class TestBootRegistry:
    def test_all_v1_entities_registered(self):
        actual = {spec.entity_type for spec in REGISTRY}
        assert EXPECTED_ENTITY_TYPES.issubset(actual), (
            f"missing: {EXPECTED_ENTITY_TYPES - actual}"
        )

    def test_each_spec_has_search_fields(self):
        for spec in REGISTRY:
            assert spec.search_fields, f"{spec.entity_type} has empty search_fields"

    def test_each_spec_url_template_has_id_placeholder(self):
        for spec in REGISTRY:
            assert "{id}" in spec.url_template, (
                f"{spec.entity_type} url_template missing {{id}}"
            )

    def test_the_money_family_links_stay_inside_the_money_module(self):
        """Comptes, dépenses, budgets et récurrences sont **une** famille d'URLs.

        Trois de ses entités pointaient sur `/app/banking`, `/app/expenses` et
        `/app/budget` après la fusion du parcours 26 ; deux autres sur
        `/app/budget/recurring`, resté hors de la famille jusqu'à l'audit de
        juillet 2026. Une redirection rattrape l'ancien lien, mais un lien de
        l'agent est produit *aujourd'hui* : le faire passer par une redirection,
        c'est accepter qu'il pointe vers une URL qu'on a décidé d'abandonner.

        D'où la seconde moitié du test : `/app/money?tab=budgets` **était** une
        page et n'est plus qu'une redirection depuis l'éclatement du module
        (issue #562). Un lien qui la vise reste valide, donc rien ne le
        signalerait — et c'est exactement pour ça qu'il se teste.
        """
        money = {"budget", "recurring_expense"}
        seen = set()
        for spec in REGISTRY:
            if spec.entity_type in money:
                seen.add(spec.entity_type)
                assert spec.url_template.startswith("/app/money"), (
                    f"{spec.entity_type} points outside the money module: "
                    f"{spec.url_template}"
                )
                assert not spec.url_template.startswith("/app/money?"), (
                    f"{spec.entity_type} goes through the `?tab=` redirect instead "
                    f"of the page that now holds it: {spec.url_template}"
                )
        # Sans ça, renommer une entité rendrait ce test muet au lieu de rouge.
        assert seen == money, f"entités de la famille argent introuvables : {money - seen}"


class TestEveryLinkTheAgentProducesLandsSomewhere:
    """Un `url_template` est une **promesse d'adresse**, et rien ne la vérifiait.

    Le registre est la seule chose qui sait quels liens l'app fabrique : citation
    de l'agent, résultat de la palette ⌘K, lien du toast « Annuler » d'une création.
    Aucun d'eux n'est écrit en dur dans le front, donc aucun contrôle du front ne
    les voit — ni le lint, ni TypeScript, ni une relecture de diff, où un template
    faux ressemble exactement à un template juste.

    Cinq liens morts vivaient en prod le jour où ce test a été écrit :

    - `contact` → `/app/directory/{id}` et `structure` →
      `/app/directory/structures/{id}` : l'annuaire n'a **jamais eu** de page de
      détail. Résultat, le 404 de l'app.
    - `insurance_contract` → `/app/insurance/{id}` : idem.
    - `tree_event` et `harvest` → `/app/orchard/{id}`, le template de l'**arbre**
      recopié sur ses enfants. Celui-là est pire : la route existe, donc le
      premier contrôle passe. La page charge un `Tree` avec l'uuid d'un événement,
      n'en trouve aucun, et rend un écran **blanc**.

    D'où deux contrôles, et il faut les deux : le premier dit « cette adresse
    existe », le second « cette adresse est à toi ».
    """

    @staticmethod
    def _declared_routes() -> set[str]:
        """Les chemins déclarés dans `ui/src/router.tsx`, en absolu."""
        import re
        from pathlib import Path

        source = (
            Path(__file__).resolve().parents[3] / "ui/src/router.tsx"
        ).read_text(encoding="utf-8")
        # Le parseur suppose un seul niveau d'imbrication (`/app`), ce qui est vrai
        # aujourd'hui. Si un second `children:` apparaît, les chemins relatifs
        # cessent d'être tous sous `/app` et ce test deviendrait faux **en silence**
        # — donc il refuse de deviner.
        assert source.count("children:") == 1, (
            "router.tsx a gagné un niveau d'imbrication : mettre ce parseur à jour "
            "avant qu'il ne valide des routes qui n'existent pas"
        )
        routes: set[str] = set()
        for raw in re.findall(r"path: '([^']*)'", source):
            if raw in {"*", "/"}:
                continue
            routes.add(raw if raw.startswith("/") else f"/app/{raw}")
        return routes

    @classmethod
    def _resolves(cls, template: str, routes: set[str]) -> bool:
        """Le chemin du template (hors query string) correspond-il à une route ?"""
        wanted = template.split("?", 1)[0].strip("/").split("/")
        for route in routes:
            declared = route.strip("/").split("/")
            if len(declared) != len(wanted):
                continue
            if all(d.startswith(":") or d == w for d, w in zip(declared, wanted)):
                return True
        return False

    @staticmethod
    def _all_specs():
        from agent.searchables import REGISTRY as SEARCHABLES
        from agent.writables import REGISTRY as WRITABLES

        writables = (
            list(WRITABLES.values()) if isinstance(WRITABLES, dict) else list(WRITABLES)
        )
        return [("searchable", s) for s in SEARCHABLES] + [
            ("writable", s) for s in writables
        ]

    def test_every_url_template_resolves_to_a_declared_route(self):
        routes = self._declared_routes()
        dead = [
            f"{kind} {spec.entity_type} → {spec.url_template}"
            for kind, spec in self._all_specs()
            if not self._resolves(spec.url_template, routes)
        ]
        assert not dead, (
            "ces liens ne mènent nulle part — l'agent les cite et la palette les "
            f"ouvre : {sorted(dead)}"
        )

    def test_a_detail_route_belongs_to_a_single_entity(self):
        """Un `{id}` dans le **chemin** dit « cette page me charge par mon id ».

        Deux entités ne peuvent donc pas partager le même chemin de détail : la
        page en résout une seule, et la seconde arrive avec un id que personne ne
        sait lire. Un `{id}` en query string ne revendique pas la page — il la
        traverse — donc il est hors périmètre.
        """
        from agent.searchables import REGISTRY

        owners: dict[str, set[str]] = {}
        for spec in REGISTRY:
            path = spec.url_template.split("?", 1)[0]
            if "{id}" not in path:
                continue
            owners.setdefault(path, set()).add(spec.model.__name__)

        shared = {path: models for path, models in owners.items() if len(models) > 1}
        assert not shared, (
            "un chemin de détail revendiqué par plusieurs modèles — la page en "
            f"charge un seul, les autres tombent sur une page vide : {shared}"
        )
