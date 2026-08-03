"""Le registre des capacités optionnelles — et les trois dérives qu'il empêche.

Une capacité absente ne casse rien : l'assistant répondait « je ne sais pas »,
la jambe sémantique renvoyait `[]`, l'e-mail partait dans les logs. Le défaut
était ailleurs — **l'interface promettait quand même**, et l'utilisateur en
concluait que le produit était mauvais plutôt qu'il lui manquait une clé.

Ces tests tiennent ce que le registre promet en retour : que l'état soit lu à
chaque appel et non figé à l'import, que le lien « comment l'activer » atteigne
une section qui existe, et que le libellé existe dans les quatre langues. Les
trois se cassent en silence — c'est ce qui les rend testables et pas relisables.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pytest
from django.test import override_settings

from app_settings.capabilities import (
    REGISTRY,
    CapabilityUnavailable,
    is_available,
    require,
    snapshot,
)

from .factories import UserFactory

REPO_ROOT = Path(__file__).resolve().parents[3]
DOCS_PAGE = REPO_ROOT / "docs/self-hosting/ai-providers.md"
LOCALES = REPO_ROOT / "ui/src/locales"
LANGUAGES = ("en", "fr", "de", "es")

CAPABILITIES_URL = "/api/capabilities/"


def _github_slug(heading: str) -> str:
    """L'ancre que GitHub fabrique pour un titre.

    Minuscules, ponctuation retirée, espaces en tirets. C'est cette règle-là qui
    décide si le lien du registre atterrit quelque part — pas une ancre explicite
    ``{#…}``, que GitHub n'interprète pas et affiche telle quelle.
    """
    slug = heading.strip().lower()
    slug = re.sub(r"[^\w\s-]", "", slug)
    return re.sub(r"\s+", "-", slug)


def _doc_anchors() -> set[str]:
    text = DOCS_PAGE.read_text(encoding="utf-8")
    return {_github_slug(m) for m in re.findall(r"^#{1,6}\s+(.+)$", text, re.MULTILINE)}


class TestTheStateIsReadNotFrozen:
    """Un booléen calculé à l'import gèlerait l'état du premier démarrage.

    Ajouter une clé et redémarrer ne changerait rien tant que le process vit, et
    aucun test ne pourrait simuler l'absence de clé. D'où le callable — vérifié
    ici en le faisant répondre deux choses différentes dans la même session.
    """

    @override_settings(ANTHROPIC_API_KEY="", LLM_PROVIDER="anthropic")
    def test_no_key_means_unavailable(self):
        assert is_available("assistant") is False

    @override_settings(ANTHROPIC_API_KEY="sk-ant-test", LLM_PROVIDER="anthropic")
    def test_a_key_flips_it_without_a_restart(self):
        assert is_available("assistant") is True

    @override_settings(ANTHROPIC_API_KEY="sk-ant-test", LLM_PROVIDER="ollama")
    def test_an_unknown_provider_is_unavailable_not_optimistic(self):
        """`get_llm_client` lève sur ce qu'il ne connaît pas : promettre ici
        ferait démentir l'écran par le premier message."""
        assert is_available("assistant") is False

    def test_an_unknown_key_is_unavailable(self):
        """Un appelant qui se trompe de clé doit dégrader, pas promettre."""
        assert is_available("does_not_exist") is False


class TestEachCapabilityIsAnchoredInTheDocs:
    """Le lien « comment l'activer » doit atteindre une section qui existe.

    Sans ce contrôle il meurt le jour où il est écrit, et « nécessite une clé
    Anthropic » redevient exactement le mur qu'on voulait supprimer. Même raison
    que la parité des catalogues i18n : deux textes qui divergent font perdre
    leur crédit aux deux.
    """

    def test_the_page_exists(self):
        assert DOCS_PAGE.exists(), f"{DOCS_PAGE} manquante — le registre y renvoie"

    def test_every_anchor_reaches_a_heading(self):
        anchors = _doc_anchors()
        missing = {
            spec.key: spec.doc_anchor for spec in REGISTRY if spec.doc_anchor not in anchors
        }
        assert not missing, (
            f"capacités dont le lien de doc ne mène nulle part : {missing} — "
            f"ancres disponibles : {sorted(anchors)}"
        )

    def test_a_wrong_anchor_would_be_caught(self):
        """Sabotage : la première version d'un test de ce genre passait à vide."""
        assert "capacite-inventee" not in _doc_anchors()


class TestEachCapabilityIsNamedInTheFourCatalogues:
    """Ajouter une capacité = une entrée au registre + ses clés i18n.

    Vérifié depuis Python, seul côté qui connaît la liste des capacités — miroir
    de `test_global_search.py::TestThePaletteCoversTheRegistry`. Une clé
    construite (`t(\\`capabilities.${key}.name\\`)`) échappe par construction au
    contrôle statique de `keys.test.ts` : la contrepartie est que le catalogue
    doit couvrir **toutes** les valeurs de l'énumération.
    """

    REQUIRED_SUBKEYS = ("name", "unavailable", "without", "enabled")

    @staticmethod
    def _catalogue(lang: str) -> dict:
        path = LOCALES / lang / "translation.json"
        return json.loads(path.read_text(encoding="utf-8")).get("capabilities", {})

    @pytest.mark.parametrize("lang", LANGUAGES)
    def test_every_capability_has_its_labels(self, lang):
        catalogue = self._catalogue(lang)
        missing = [
            f"capabilities.{spec.key}.{sub}"
            for spec in REGISTRY
            for sub in self.REQUIRED_SUBKEYS
            if not catalogue.get(spec.key, {}).get(sub)
        ]
        assert not missing, f"clés absentes du catalogue {lang} : {missing}"

    @pytest.mark.parametrize("lang", LANGUAGES)
    def test_the_shared_labels_exist(self, lang):
        catalogue = self._catalogue(lang)
        for key in ("title", "description", "envVars", "howToEnable"):
            assert catalogue.get(key), f"capabilities.{key} absente du catalogue {lang}"


class TestTheSnapshotNeverLeaksAValue:
    """La liste dit quels réglages manquent, jamais ce qu'ils contiennent."""

    @override_settings(ANTHROPIC_API_KEY="sk-ant-super-secret")
    def test_only_the_variable_names_travel(self):
        payload = json.dumps(snapshot())
        assert "sk-ant-super-secret" not in payload
        assert "ANTHROPIC_API_KEY" in payload

    def test_the_payload_is_stable(self):
        keys = [row["key"] for row in snapshot()]
        assert keys == sorted(keys)
        assert set(keys) == {spec.key for spec in REGISTRY}


class TestTheEndpoint:
    @pytest.mark.django_db
    def test_it_answers_the_registry(self, client):
        client.force_login(UserFactory())

        response = client.get(CAPABILITIES_URL)

        assert response.status_code == 200
        rows = response.json()["capabilities"]
        assert {row["key"] for row in rows} == {spec.key for spec in REGISTRY}
        for row in rows:
            assert set(row) == {"key", "available", "env_vars", "docs_url"}

    @pytest.mark.django_db
    def test_it_requires_a_logged_in_user(self, client):
        """La liste des réglages manquants est une cartographie utile à qui
        cherche une porte — elle ne se sert pas à un anonyme."""
        response = client.get(CAPABILITIES_URL)

        assert response.status_code in (401, 403)


class TestARefusalIsNamed:
    """« Indisponible » se dit en 503 nommé, jamais en 500 ni en 200 inventé."""

    @override_settings(ANTHROPIC_API_KEY="")
    def test_require_raises_a_503_carrying_the_way_out(self):
        with pytest.raises(CapabilityUnavailable) as excinfo:
            require("assistant")

        detail = excinfo.value.detail
        assert excinfo.value.status_code == 503
        assert detail["capability"] == "assistant"
        assert detail["code"] == "capability_unavailable"
        assert "ANTHROPIC_API_KEY" in detail["env_vars"]
        assert "ai-providers.md#assistant-anthropic" in detail["docs_url"]

    @override_settings(ANTHROPIC_API_KEY="sk-ant-test", LLM_PROVIDER="anthropic")
    def test_it_stays_silent_when_the_capability_is_there(self):
        require("assistant")  # ne lève pas
