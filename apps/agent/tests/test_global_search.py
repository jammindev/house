"""Tests for `GET /api/search/` — the app-wide search box.

The endpoint adds no retrieval logic of its own: it exists to expose the agent's
index to the UI. So what is worth locking is exactly that — that it stays the *same*
search (same ranking, same household scope, same module gating as the
`search_household` tool), that a type-ahead cannot become expensive, and that the
snippet reaches the client with the markers it needs to highlight.
"""
from __future__ import annotations

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from agent import retrieval
from households.models import Household, HouseholdMember

URL = "/api/search/"


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def owner(db):
    return UserFactory(email="search-owner@example.com")


@pytest.fixture
def household(db, owner):
    h = Household.objects.create(name="Search House")
    HouseholdMember.objects.create(user=owner, household=h, role=HouseholdMember.Role.OWNER)
    owner.active_household = h
    owner.save(update_fields=["active_household"])
    return h


@pytest.fixture
def stranger(db):
    """A user of another household, with a project of the same name."""
    user = UserFactory(email="search-stranger@example.com")
    other = Household.objects.create(name="Other House")
    HouseholdMember.objects.create(user=user, household=other, role=HouseholdMember.Role.OWNER)
    user.active_household = other
    user.save(update_fields=["active_household"])
    return user


@pytest.fixture
def owner_client(owner, household):
    return _client_for(owner)


@pytest.fixture
def project(household):
    from projects.models import Project

    return Project.objects.create(
        household=household,
        title="Pompe à chaleur",
        description="Remplacement de la chaudière au fioul",
    )


def _results(resp) -> list[dict]:
    return resp.json()["results"]


def _labels(resp) -> list[str]:
    return [row["label"] for row in _results(resp)]


@pytest.mark.django_db
class TestSearching:
    def test_finds_an_entity_by_its_name(self, owner_client, project):
        resp = owner_client.get(URL, {"q": "pompe"})
        assert resp.status_code == status.HTTP_200_OK
        assert "Pompe à chaleur" in _labels(resp)

    def test_finds_an_entity_by_its_body(self, owner_client, project):
        resp = owner_client.get(URL, {"q": "chaudière"})
        assert "Pompe à chaleur" in _labels(resp)

    def test_accents_are_ignored(self, owner_client, project):
        """`simple_unaccent`: typing without accents must still match."""
        resp = owner_client.get(URL, {"q": "chaudiere"})
        assert "Pompe à chaleur" in _labels(resp)

    def test_a_result_carries_what_the_palette_needs(self, owner_client, project):
        resp = owner_client.get(URL, {"q": "pompe"})
        row = next(r for r in _results(resp) if r["label"] == "Pompe à chaleur")
        assert row["entity_type"] == "project"
        assert row["object_id"] == str(project.id)
        assert row["url"] == f"/app/projects/{project.id}"

    def test_the_snippet_keeps_its_highlight_markers(self, owner_client, project):
        """The client renders `<<…>>` as `<mark>`; stripping them here would make
        the snippet a blob of text with no visible reason for being shown."""
        resp = owner_client.get(URL, {"q": "chaudière"})
        row = next(r for r in _results(resp) if r["label"] == "Pompe à chaleur")
        assert "<<" in row["snippet"] and ">>" in row["snippet"]

    def test_no_match_is_an_empty_list_not_an_error(self, owner_client, project):
        resp = owner_client.get(URL, {"q": "zzzznothing"})
        assert resp.status_code == status.HTTP_200_OK
        assert _results(resp) == []


@pytest.mark.django_db
class TestScope:
    def test_another_household_never_surfaces(self, stranger, project):
        """`project` belongs to the owner's household — the stranger must see nothing."""
        resp = _client_for(stranger).get(URL, {"q": "pompe"})
        assert resp.status_code == status.HTTP_200_OK
        assert _results(resp) == []

    def test_anonymous_is_rejected(self, project):
        resp = APIClient().get(URL, {"q": "pompe"})
        assert resp.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    def test_a_disabled_module_is_invisible(self, owner_client, household):
        """Same gating as the agent: an entity of a module the household turned off
        does not exist as far as search is concerned."""
        from chickens.models import Chicken

        Chicken.objects.create(household=household, name="Roussette la poule")
        assert "Roussette la poule" in _labels(owner_client.get(URL, {"q": "roussette"}))

        household.disabled_modules = ["chickens"]
        household.save(update_fields=["disabled_modules"])
        assert _results(owner_client.get(URL, {"q": "roussette"})) == []


def _spy_on_retrieval(monkeypatch) -> list[dict]:
    """Replace `retrieval.search` with a recorder. Returns the list of calls."""
    calls: list[dict] = []

    def _record(household_id, query, limit=20, disabled=None, **kwargs):
        calls.append({"query": query, "limit": limit, **kwargs})
        return []

    monkeypatch.setattr("agent.search_api.retrieval.search", _record)
    return calls


@pytest.mark.django_db
class TestBounds:
    def test_a_blank_query_searches_nothing(self, owner_client, project, monkeypatch):
        """No query, no work — an empty box must not scan every table."""
        calls = _spy_on_retrieval(monkeypatch)
        assert _results(owner_client.get(URL, {"q": "   "})) == []
        assert _results(owner_client.get(URL)) == []
        assert calls == []

    def test_a_single_character_searches_nothing(self, owner_client, project):
        """One letter matches nearly everything and ranks nothing. The client gates
        at two characters; the server enforces it so a direct caller cannot."""
        assert _results(owner_client.get(URL, {"q": "p"})) == []

    def test_limit_is_clamped(self, owner_client, monkeypatch):
        calls = _spy_on_retrieval(monkeypatch)
        owner_client.get(URL, {"q": "pompe", "limit": "5000"})
        assert calls[0]["limit"] == 50

    def test_a_garbage_limit_falls_back_to_the_default(self, owner_client, monkeypatch):
        calls = _spy_on_retrieval(monkeypatch)
        owner_client.get(URL, {"q": "pompe", "limit": "beaucoup"})
        assert calls[0]["limit"] == 20


@pytest.mark.django_db
class TestTheSemanticLegStaysOut:
    """A debounced keystroke must never cost an embedding call.

    The hybrid flag is the right default for a question asked to the agent (one
    embedding per turn). On a search box it would be one per keystroke — so the
    palette opts out explicitly instead of inheriting the setting.
    """

    def test_hybrid_is_off_even_when_the_setting_is_on(
        self, owner_client, project, settings, monkeypatch
    ):
        settings.AGENT_HYBRID_RETRIEVAL_ENABLED = True

        def _boom(*args, **kwargs):  # pragma: no cover - must never run
            raise AssertionError("the global search must not embed the query")

        monkeypatch.setattr("agent.embeddings.get_embedding_client", _boom)

        resp = owner_client.get(URL, {"q": "pompe"})
        assert resp.status_code == status.HTTP_200_OK
        assert "Pompe à chaleur" in _labels(resp)

    def test_the_agent_still_honours_the_setting(
        self, household, project, settings, monkeypatch
    ):
        """The opt-out is the palette's, not a global kill switch: `search()` with no
        `hybrid` argument keeps reading the flag."""
        settings.AGENT_HYBRID_RETRIEVAL_ENABLED = True
        calls = []

        def _spy(*args, **kwargs):
            calls.append(1)
            return []

        monkeypatch.setattr("agent.retrieval._vector_search", _spy)
        retrieval.search(household.id, "pompe")
        assert calls == [1]


class TestThePaletteCoversTheRegistry:
    """The registry is the source of truth; the palette must not lag behind it.

    Registering a `SearchableSpec` is all it takes to make an entity findable — which
    means a new entity type reaches the search box with no front-end change at all,
    and would show up there under a generic glyph and a raw i18n key. Both files
    below are checked from Python, on the registry itself, because that is the only
    side that knows the full list.
    """

    @staticmethod
    def _entity_types() -> set[str]:
        from agent.searchables import REGISTRY

        return {spec.entity_type for spec in REGISTRY}

    def test_every_searchable_type_has_an_icon(self):
        from pathlib import Path

        source = (
            Path(__file__).resolve().parents[3]
            / "ui/src/features/agent/entityIcons.ts"
        ).read_text(encoding="utf-8")
        missing = {t for t in self._entity_types() if f"  {t}:" not in source}
        assert not missing, (
            f"entity types without an icon in entityIcons.ts: {sorted(missing)} — "
            "they would all render as the same fallback glyph in the search palette"
        )

    def test_every_searchable_type_has_a_group_label_in_the_four_catalogues(self):
        import json
        from pathlib import Path

        ui = Path(__file__).resolve().parents[3] / "ui/src/locales"
        for lang in ("en", "fr", "de", "es"):
            catalogue = json.loads(
                (ui / lang / "translation.json").read_text(encoding="utf-8")
            )
            labels = catalogue.get("search", {}).get("entity", {})
            missing = self._entity_types() - set(labels)
            assert not missing, (
                f"{lang}: search.entity.* is missing {sorted(missing)} — the palette "
                "would show a raw i18n key as a group heading"
            )


@pytest.mark.django_db
class TestTheTwoSearchBoxesAgree:
    """The palette and the agent's context picker are one search, not two.

    They had to be: a user who finds a document in the top bar and cannot find it in
    the picker (or the reverse) has no way to tell which of the two is lying about
    what the household contains.
    """

    def test_same_results_as_the_context_picker(self, owner_client, project):
        palette = _results(owner_client.get(URL, {"q": "pompe"}))
        picker = owner_client.get(
            "/api/agent/conversations/search_context/", {"q": "pompe"}
        ).json()
        assert palette == picker

    def test_same_results_as_the_agent_tool(self, owner_client, household, project):
        palette = _results(owner_client.get(URL, {"q": "pompe"}))
        hits = retrieval.search(household.id, "pompe", limit=20, hybrid=False)
        assert [row["object_id"] for row in palette] == [str(hit.id) for hit in hits]
