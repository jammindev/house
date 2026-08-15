# orchard/tests/test_services.py
"""
Service-layer tests — the single write path shared by REST and the agent.

The equivalence test at the bottom is the one that locks the no-duplication
rule: whatever the agent ends up calling, it must produce the same row as the
REST endpoint.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from households.models import HouseholdMember
from orchard import services
from orchard.models import Harvest, Tree, TreeEvent
from zones.models import Zone

from .factories import (
    HouseholdFactory,
    HouseholdMemberFactory,
    TreeFactory,
    UserFactory,
)


def _setup():
    hh = HouseholdFactory()
    user = UserFactory()
    HouseholdMemberFactory(household=hh, user=user, role=HouseholdMember.Role.OWNER)
    user.active_household = hh
    user.save(update_fields=["active_household"])
    zone = Zone.objects.create(household=hh, name="Verger", created_by=user)
    return hh, user, zone


@pytest.mark.django_db
class TestResolveTree:
    """A household says « le prunier », never a UUID."""

    def test_resolves_by_exact_name(self):
        hh, user, zone = _setup()
        tree = TreeFactory(household=hh, zone=zone, created_by=user, name="Le prunier")
        assert services.resolve_tree(hh, "le prunier") == tree

    def test_resolves_by_partial_name(self):
        hh, user, zone = _setup()
        tree = TreeFactory(household=hh, zone=zone, created_by=user, name="Le gros pommier")
        assert services.resolve_tree(hh, "gros") == tree

    def test_resolves_by_id(self):
        hh, user, zone = _setup()
        tree = TreeFactory(household=hh, zone=zone, created_by=user)
        assert services.resolve_tree(hh, str(tree.id)) == tree

    def test_an_ambiguous_name_names_the_candidates_and_writes_nothing(self):
        hh, user, zone = _setup()
        TreeFactory(household=hh, zone=zone, created_by=user, name="Prunier du haut")
        TreeFactory(household=hh, zone=zone, created_by=user, name="Prunier du bas")

        with pytest.raises(ValueError) as excinfo:
            services.resolve_tree(hh, "prunier")

        message = str(excinfo.value)
        assert "Prunier du haut" in message and "Prunier du bas" in message

    def test_an_unknown_name_is_refused(self):
        hh, user, zone = _setup()
        with pytest.raises(ValueError):
            services.resolve_tree(hh, "figuier")

    def test_it_never_crosses_the_household_boundary(self):
        hh, user, zone = _setup()
        other_hh, other_user, other_zone = _setup()
        TreeFactory(
            household=other_hh, zone=other_zone, created_by=other_user, name="Chez le voisin"
        )
        with pytest.raises(ValueError):
            services.resolve_tree(hh, "Chez le voisin")


@pytest.mark.django_db
class TestWriteServices:
    def test_create_tree_requires_a_zone_of_the_household(self):
        hh, user, zone = _setup()
        other_hh, other_user, foreign_zone = _setup()

        from rest_framework.exceptions import ValidationError

        with pytest.raises(ValidationError):
            services.create_tree(hh, user, name="Voleur", zone_id=foreign_zone.id)

    def test_event_date_defaults_to_the_households_today(self):
        hh, user, zone = _setup()
        tree = TreeFactory(household=hh, zone=zone, created_by=user)
        event = services.create_event(hh, user, tree=tree, type="pruning", title="Taille")
        assert event.occurred_on is not None
        assert event.household_id == hh.id

    def test_delete_refuses_a_foreign_object(self):
        hh, user, zone = _setup()
        other_hh, other_user, other_zone = _setup()
        foreign = TreeFactory(household=other_hh, zone=other_zone, created_by=other_user)
        with pytest.raises(ValueError):
            services.delete_tree(hh, user, foreign)


@pytest.mark.django_db
class TestTheServiceAndTheApiAgree:
    """The no-duplication lock: one write path, two callers, one result."""

    def test_a_subject_created_by_the_service_matches_one_created_by_rest(self):
        hh, user, zone = _setup()

        client = APIClient()
        client.force_authenticate(user=user)
        response = client.post(
            reverse("orchard-tree-list"),
            {
                "name": "Par REST", "zone_id": str(zone.id), "kind": "vine",
                "species": "Chasselas", "planted_on": "2020-04-01", "notes": "n",
            },
            format="json",
        )
        via_rest = Tree.objects.get(id=response.data["id"])

        via_service = services.create_tree(
            hh, user,
            name="Par service", zone_id=zone.id, kind="vine",
            species="Chasselas", planted_on=date(2020, 4, 1), notes="n",
        )

        compared = ("household_id", "zone_id", "kind", "species", "planted_on",
                    "status", "notes", "created_by_id")
        for field in compared:
            assert getattr(via_rest, field) == getattr(via_service, field), field

    def test_a_harvest_created_by_the_service_matches_one_created_by_rest(self):
        hh, user, zone = _setup()
        tree = TreeFactory(household=hh, zone=zone, created_by=user)

        client = APIClient()
        client.force_authenticate(user=user)
        response = client.post(
            reverse("orchard-harvest-list"),
            {
                "tree": str(tree.id), "harvested_on": "2026-09-20",
                "quantity": "12.500", "unit": "kg",
            },
            format="json",
        )
        via_rest = Harvest.objects.get(id=response.data["id"])

        via_service = services.create_harvest(
            hh, user, tree=tree, quantity=Decimal("12.500"),
            unit="kg", harvested_on=date(2026, 9, 20),
        )

        for field in ("household_id", "tree_id", "harvested_on", "quantity", "unit"):
            assert getattr(via_rest, field) == getattr(via_service, field), field
