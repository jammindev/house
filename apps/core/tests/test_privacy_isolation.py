"""Isolation en confidentialité — un item privé ne sort pas de sa liste.

Troisième volet de la famille ``test_tenant_isolation`` (lectures entre foyers)
et ``test_write_isolation`` (FK de serializer). Celui-ci porte sur la frontière
*à l'intérieur* d'un foyer : ``moi`` vs ``les autres membres``.

Pourquoi un test transverse et pas trois tests locaux
-----------------------------------------------------

``is_private`` existait sur quatre modèles, avec son badge dans l'UI, sa
contrainte DB et son exclusion du récap — et n'était filtré en liste que sur
deux d'entre eux. Le drapeau était décoratif là où il comptait le plus, et
personne ne l'a vu, parce que le défaut est invisible deux fois :

- **en revue**, un ``get_queryset()`` qui oublie la clause ressemble trait pour
  trait à celui qui la porte ;
- **à l'usage**, il faut deux comptes dans le même foyer pour s'en apercevoir —
  c'est-à-dire précisément ce qu'un développeur seul n'a jamais sous la main.

D'où la forme : le test ne vérifie pas trois vues, il vérifie **la règle**, et
refuse qu'un cinquième modèle privatisable arrive sans se déclarer.

Les deux moitiés sont nécessaires
---------------------------------

1. **Structurelle** — aucune vue n'expose ``is_private`` en filtre. Sans ce
   contrôle, la moitié n°2 se laisse contourner : le queryset a beau borner, un
   ``?is_private=true`` ré-ouvre exactement ce qu'il bornait. C'est le même
   rapport que la clé i18n et son ``defaultValue``.
2. **Comportementale** — un second membre ne voit pas l'item privé du premier.
   C'est le seul contrôle qui compare le *code* à ce que l'API sert vraiment.
"""
import inspect
import importlib

import pytest
from django.apps import apps as django_apps
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.viewsets import GenericViewSet

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdMember


# ── Ce qui n'est pas encore filtré, et pourquoi ──────────────────────────────
#
# Même convention que ``EXEMPT_FIELDS`` dans ``test_write_isolation`` : une
# exemption est une dette **nommée**, avec sa raison et ce qui protège à la
# place. Le silence, lui, ne se relit pas.

EXEMPT_MODELS: dict[str, str] = {
    "interactions.Interaction": (
        "Une interaction de type 'expense' alimente interactions.queries.expenses(), "
        "point de vérité unique de sept agrégations (barre de budget, coverage_ratio, "
        "Project.actual_cost, bilan mensuel, détecteurs de conformité). La masquer en "
        "liste sans la retirer des totaux donnerait deux définitions au même compteur — "
        "exactement ce que CLAUDE.md interdit. Filtrer ici suppose d'avoir décidé ce que "
        "« dépense privée » veut dire ; tant que ce n'est pas tranché, la porte la plus "
        "large (le filtre ?is_private=) est fermée par la moitié n°1 de ce fichier."
    ),
}


def _models_with_is_private():
    """Tous les modèles du projet portant un champ ``is_private``."""
    found = []
    for model in django_apps.get_models():
        if not model._meta.app_config.name.startswith(("apps.", "")):
            continue
        if any(f.name == "is_private" for f in model._meta.get_fields()):
            found.append(model)
    return found


def _label(model) -> str:
    return f"{model._meta.app_label}.{model.__name__}"


def _all_viewsets():
    """Toutes les classes de viewset déclarées dans les modules ``views`` du projet."""
    found = {}
    for config in django_apps.get_app_configs():
        for module_name in (f"{config.name}.views", f"{config.name}.views_media"):
            try:
                module = importlib.import_module(module_name)
            except ModuleNotFoundError:
                continue
            for name, obj in inspect.getmembers(module, inspect.isclass):
                if issubclass(obj, GenericViewSet) and obj.__module__ == module_name:
                    found[f"{module_name}.{name}"] = obj
    return found


# ── 1. Structurel : aucun filtre ne ré-ouvre ce que le queryset borne ────────


class TestNoViewExposesThePrivacyFlagAsAFilter:
    def test_no_filterset_field_named_is_private(self):
        offenders = [
            name
            for name, viewset in _all_viewsets().items()
            if "is_private" in (getattr(viewset, "filterset_fields", None) or ())
        ]
        assert not offenders, (
            "Ces vues exposent ?is_private= en filtre, c'est-à-dire l'endroit exact "
            "où lire les items privés des autres membres : "
            f"{offenders}. Un filtre ne doit jamais pouvoir élargir ce que borne le "
            "queryset — pour retrouver ses propres items privés, filtrer côté client "
            "ou ajouter un ?mine=true qui ne peut porter que sur soi."
        )


# ── 2. Comportemental : le second membre ne voit rien ────────────────────────


@pytest.fixture
def duo(db):
    """Un foyer, deux membres : Alice écrit, Bob lit."""
    household = Household.objects.create(name="Foyer privé")
    alice = UserFactory(email="privacy-alice@example.com")
    bob = UserFactory(email="privacy-bob@example.com")
    HouseholdMember.objects.create(household=household, user=alice, role="owner")
    HouseholdMember.objects.create(household=household, user=bob, role="member")
    return household, alice, bob


def _as(user, household):
    client = APIClient()
    client.force_authenticate(user=user)
    return client, {"household_id": str(household.id)}


def _labels(response, key):
    payload = response.data
    rows = payload if isinstance(payload, list) else (payload.get("results") or [])
    return [row.get(key) for row in rows]


@pytest.mark.django_db
class TestAPrivateItemStaysWithItsAuthor:
    """Pour chaque modèle couvert : Alice le voit, Bob ne le voit pas."""

    def test_task(self, duo):
        from tasks.models import Task

        household, alice, bob = duo
        Task.objects.create(
            household=household, created_by=alice,
            subject="Cadeau d'anniversaire de Bob", is_private=True,
        )

        client, params = _as(bob, household)
        assert "Cadeau d'anniversaire de Bob" not in _labels(
            client.get(reverse("task-list"), params), "subject"
        )

        client, params = _as(alice, household)
        assert "Cadeau d'anniversaire de Bob" in _labels(
            client.get(reverse("task-list"), params), "subject"
        )

    def test_document(self, duo):
        from documents.models import Document

        household, alice, bob = duo
        Document.objects.create(
            household=household, created_by=alice,
            name="Bilan médical", file_path=f"{household.id}/documents/bilan.pdf",
            is_private=True,
        )

        client, params = _as(bob, household)
        assert "Bilan médical" not in _labels(
            client.get(reverse("document-list"), params), "name"
        )

        client, params = _as(alice, household)
        assert "Bilan médical" in _labels(
            client.get(reverse("document-list"), params), "name"
        )

    def test_briefing(self, duo):
        from briefings.models import Briefing

        household, alice, bob = duo
        Briefing.objects.create(
            household=household, created_by=alice,
            title="Mes rendez-vous", prompt="Résume mon agenda", is_private=True,
        )

        client, params = _as(bob, household)
        assert "Mes rendez-vous" not in _labels(
            client.get(reverse("briefing-list"), params), "title"
        )

        client, params = _as(alice, household)
        assert "Mes rendez-vous" in _labels(
            client.get(reverse("briefing-list"), params), "title"
        )


# ── 3. Le catalogue ne peut pas prendre de retard sur le code ────────────────


class TestEveryPrivatisableModelIsAccountedFor:
    """Un cinquième modèle portant ``is_private`` doit se déclarer ici.

    Sans ce contrôle, les deux moitiés ci-dessus resteraient vertes en ignorant
    le nouveau venu — c'est la même règle que ``banking.compliance.REGISTRY`` :
    ajouter un mécanisme, c'est ajouter son détecteur.
    """

    COVERED = {"tasks.Task", "documents.Document", "briefings.Briefing"}

    def test_no_model_carries_the_flag_without_a_test_or_a_named_exemption(self):
        accounted = self.COVERED | set(EXEMPT_MODELS)
        actual = {_label(model) for model in _models_with_is_private()}

        unaccounted = actual - accounted
        assert not unaccounted, (
            f"Ces modèles portent is_private sans être couverts ni exemptés : "
            f"{sorted(unaccounted)}. Ajouter un cas dans "
            "TestAPrivateItemStaysWithItsAuthor, ou une entrée motivée dans "
            "EXEMPT_MODELS."
        )

        stale = accounted - actual
        assert not stale, (
            f"Ces entrées ne correspondent plus à aucun modèle : {sorted(stale)}. "
            "Une exemption périmée a l'air de faire autorité en étant fausse."
        )
