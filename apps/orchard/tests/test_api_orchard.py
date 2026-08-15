# orchard/tests/test_api_orchard.py
"""
REST API tests for the orchard module — TreeViewSet, TreeEventViewSet,
HarvestViewSet, plus the zone-deletion refusal the required FK introduces.

Coverage:
  1. Tree CRUD + household scoping
  2. The zone is required, belongs to the household, and PROTECTs the subject
  3. Default listing shows the living orchard; dead subjects keep their history
  4. Derived age, flowering window validation (both bounds or neither)
  5. Journal CRUD + filters
  6. Harvest CRUD — several pickings per season, never an upsert
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from households.models import HouseholdMember
from orchard.models import Harvest, Tree, TreeEvent
from zones.models import Zone

from .factories import (
    HarvestFactory,
    HouseholdFactory,
    HouseholdMemberFactory,
    TreeEventFactory,
    TreeFactory,
    UserFactory,
)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _make_owner(household):
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.OWNER)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user


def _make_member(household):
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.MEMBER)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _zone(household, user, name="Verger"):
    return Zone.objects.create(household=household, name=name, created_by=user)


def _setup(zone_name="Verger"):
    """A household, its owner and one zone — the shape every test needs."""
    hh = HouseholdFactory()
    owner = _make_owner(hh)
    return hh, owner, _zone(hh, owner, zone_name)


# ===========================================================================
# 1. Tree CRUD + scoping
# ===========================================================================


@pytest.mark.django_db
class TestTreeCrud:
    def test_owner_creates_a_subject(self):
        hh, owner, zone = _setup()
        response = _client_for(owner).post(
            reverse("orchard-tree-list"),
            {"name": "Le gros pommier", "zone_id": str(zone.id), "kind": "fruit_tree"},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        tree = Tree.objects.get(id=response.data["id"])
        assert tree.household == hh
        assert tree.zone == zone
        assert tree.created_by == owner

    def test_member_can_create_too(self):
        """A tree is common property of the household — no creator-only rule."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        member = _make_member(hh)
        zone = _zone(hh, owner)
        response = _client_for(member).post(
            reverse("orchard-tree-list"),
            {"name": "Framboisier", "zone_id": str(zone.id), "kind": "berry_bush"},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED

    def test_anonymous_gets_401(self):
        response = APIClient().post(reverse("orchard-tree-list"), {"name": "x"}, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_another_household_cannot_see_the_subject(self):
        hh, owner, zone = _setup()
        tree = TreeFactory(household=hh, zone=zone, created_by=owner)

        other_hh = HouseholdFactory()
        stranger = _make_owner(other_hh)
        response = _client_for(stranger).get(
            reverse("orchard-tree-detail", args=[tree.id])
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_patch_and_delete(self):
        hh, owner, zone = _setup()
        tree = TreeFactory(household=hh, zone=zone, created_by=owner)
        client = _client_for(owner)

        patch = client.patch(
            reverse("orchard-tree-detail", args=[tree.id]),
            {"species": "Belle de Boskoop"},
            format="json",
        )
        assert patch.status_code == status.HTTP_200_OK
        tree.refresh_from_db()
        assert tree.species == "Belle de Boskoop"

        delete = client.delete(reverse("orchard-tree-detail", args=[tree.id]))
        assert delete.status_code == status.HTTP_204_NO_CONTENT
        assert not Tree.objects.filter(id=tree.id).exists()

    def test_deleting_a_subject_cascades_its_journal_and_harvests(self):
        hh, owner, zone = _setup()
        tree = TreeFactory(household=hh, zone=zone, created_by=owner)
        TreeEventFactory(household=hh, tree=tree, created_by=owner)
        HarvestFactory(household=hh, tree=tree, created_by=owner)

        _client_for(owner).delete(reverse("orchard-tree-detail", args=[tree.id]))
        assert TreeEvent.objects.count() == 0
        assert Harvest.objects.count() == 0


# ===========================================================================
# 2. The zone is mandatory, scoped, and protecting
# ===========================================================================


@pytest.mark.django_db
class TestTheZoneIsMandatory:
    """ORCH-02 — a subject with no place is a subject nobody finds again."""

    def test_creating_without_a_zone_is_refused(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        response = _client_for(owner).post(
            reverse("orchard-tree-list"), {"name": "Orphelin"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "zone_id" in response.data

    def test_a_zone_from_another_household_is_refused(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        other_hh = HouseholdFactory()
        other_owner = _make_owner(other_hh)
        foreign_zone = _zone(other_hh, other_owner)

        response = _client_for(owner).post(
            reverse("orchard-tree-list"),
            {"name": "Voleur", "zone_id": str(foreign_zone.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestDeletingAnOccupiedZoneIsRefused:
    """The heart of the PROTECT decision: a named refusal, never a silent loss —
    and never a 500 on an ordinary gesture."""

    def test_it_answers_409_and_says_what_blocks(self):
        hh, owner, zone = _setup()
        TreeFactory(household=hh, zone=zone, created_by=owner, name="Le gros pommier")
        TreeFactory(household=hh, zone=zone, created_by=owner, name="Le prunier")

        response = _client_for(owner).delete(reverse("zone-detail", args=[zone.id]))

        assert response.status_code == status.HTTP_409_CONFLICT
        assert response.data["protected_count"] == 2
        # The message names what holds the zone — a bare refusal makes the user hunt.
        assert "2" in response.data["detail"]
        assert Zone.objects.filter(id=zone.id).exists()
        assert Tree.objects.count() == 2

    def test_an_empty_zone_still_deletes(self):
        hh, owner, zone = _setup()
        response = _client_for(owner).delete(reverse("zone-detail", args=[zone.id]))
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_a_parent_zone_holding_an_occupied_child_is_refused_too(self):
        """The cascade case — the one that 500s if nobody thinks about it.

        `ZoneViewSet.destroy` already refuses a zone that has children, so the
        cascade never reaches the database here. This test pins that behaviour:
        the day the children rule loosens, the PROTECT must still answer 409.
        """
        hh, owner, parent = _setup("Extérieur")
        child = Zone.objects.create(
            household=hh, name="Verger", parent=parent, created_by=owner
        )
        TreeFactory(household=hh, zone=child, created_by=owner)

        response = _client_for(owner).delete(reverse("zone-detail", args=[parent.id]))
        assert response.status_code == status.HTTP_409_CONFLICT
        assert Tree.objects.count() == 1


# ===========================================================================
# 3. Listing — the living orchard by default
# ===========================================================================


@pytest.mark.django_db
class TestTreeListing:
    def test_dead_subjects_are_hidden_but_not_deleted(self):
        hh, owner, zone = _setup()
        TreeFactory(household=hh, zone=zone, created_by=owner, name="Vivant")
        TreeFactory(
            household=hh, zone=zone, created_by=owner,
            name="Arraché", status=Tree.Status.REMOVED,
        )
        client = _client_for(owner)

        default = client.get(reverse("orchard-tree-list"))
        names = [t["name"] for t in default.data]
        assert names == ["Vivant"]

        every = client.get(reverse("orchard-tree-list"), {"status": "all"})
        assert len(every.data) == 2

        removed = client.get(reverse("orchard-tree-list"), {"status": "removed"})
        assert [t["name"] for t in removed.data] == ["Arraché"]

    def test_filters_by_zone_and_kind(self):
        hh, owner, zone = _setup()
        other_zone = _zone(hh, owner, "Potager")
        TreeFactory(household=hh, zone=zone, created_by=owner, name="Pommier")
        TreeFactory(
            household=hh, zone=other_zone, created_by=owner,
            name="Cassissier", kind=Tree.Kind.BERRY_BUSH,
        )
        client = _client_for(owner)

        by_zone = client.get(reverse("orchard-tree-list"), {"zone": str(zone.id)})
        assert [t["name"] for t in by_zone.data] == ["Pommier"]

        by_kind = client.get(reverse("orchard-tree-list"), {"kind": "berry_bush"})
        assert [t["name"] for t in by_kind.data] == ["Cassissier"]


# ===========================================================================
# 4. Derived age and the flowering window
# ===========================================================================


@pytest.mark.django_db
class TestDerivedFields:
    def test_age_is_derived_and_null_when_the_planting_date_is_unknown(self):
        hh, owner, zone = _setup()
        known = TreeFactory(
            household=hh, zone=zone, created_by=owner, planted_on=date(2015, 3, 1)
        )
        unknown = TreeFactory(
            household=hh, zone=zone, created_by=owner, planted_on=None, name="Hérité"
        )
        client = _client_for(owner)

        assert client.get(
            reverse("orchard-tree-detail", args=[known.id])
        ).data["age_years"] >= 10
        assert client.get(
            reverse("orchard-tree-detail", args=[unknown.id])
        ).data["age_years"] is None

    def test_a_half_declared_flowering_window_is_refused(self):
        """Empty means nobody filled it in; half-filled means nothing at all."""
        hh, owner, zone = _setup()
        response = _client_for(owner).post(
            reverse("orchard-tree-list"),
            {"name": "Pommier", "zone_id": str(zone.id), "flowering_start_month": 4},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_month_out_of_range_is_refused(self):
        hh, owner, zone = _setup()
        response = _client_for(owner).post(
            reverse("orchard-tree-list"),
            {
                "name": "Pommier", "zone_id": str(zone.id),
                "flowering_start_month": 4, "flowering_end_month": 13,
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_complete_window_is_accepted(self):
        hh, owner, zone = _setup()
        response = _client_for(owner).post(
            reverse("orchard-tree-list"),
            {
                "name": "Pommier", "zone_id": str(zone.id),
                "flowering_start_month": 4, "flowering_end_month": 5,
            },
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED


# ===========================================================================
# 5. Journal
# ===========================================================================


@pytest.mark.django_db
class TestTreeEvents:
    def test_create_and_filter(self):
        hh, owner, zone = _setup()
        tree = TreeFactory(household=hh, zone=zone, created_by=owner)
        other = TreeFactory(household=hh, zone=zone, created_by=owner, name="Prunier")
        client = _client_for(owner)

        created = client.post(
            reverse("orchard-event-list"),
            {
                "tree": str(tree.id), "type": "pruning",
                "title": "Taille d'hiver", "occurred_on": "2026-01-15",
            },
            format="json",
        )
        assert created.status_code == status.HTTP_201_CREATED
        TreeEventFactory(
            household=hh, tree=other, created_by=owner,
            type=TreeEvent.Type.TREATMENT, title="Bouillie bordelaise",
        )

        by_tree = client.get(reverse("orchard-event-list"), {"tree": str(tree.id)})
        assert [e["title"] for e in by_tree.data] == ["Taille d'hiver"]

        by_type = client.get(reverse("orchard-event-list"), {"type": "treatment"})
        assert [e["title"] for e in by_type.data] == ["Bouillie bordelaise"]

    def test_date_range_filter(self):
        hh, owner, zone = _setup()
        tree = TreeFactory(household=hh, zone=zone, created_by=owner)
        TreeEventFactory(
            household=hh, tree=tree, created_by=owner,
            occurred_on=date(2025, 1, 10), title="Vieille taille",
        )
        TreeEventFactory(
            household=hh, tree=tree, created_by=owner,
            occurred_on=date(2026, 1, 10), title="Taille récente",
        )
        response = _client_for(owner).get(
            reverse("orchard-event-list"), {"from": "2025-06-01"}
        )
        assert [e["title"] for e in response.data] == ["Taille récente"]

    def test_an_event_on_another_households_tree_is_refused(self):
        hh, owner, zone = _setup()
        other_hh = HouseholdFactory()
        other_owner = _make_owner(other_hh)
        foreign_tree = TreeFactory(
            household=other_hh, zone=_zone(other_hh, other_owner), created_by=other_owner
        )
        response = _client_for(owner).post(
            reverse("orchard-event-list"),
            {"tree": str(foreign_tree.id), "type": "pruning", "title": "Intrusion"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_the_date_defaults_to_today(self):
        hh, owner, zone = _setup()
        tree = TreeFactory(household=hh, zone=zone, created_by=owner)
        response = _client_for(owner).post(
            reverse("orchard-event-list"),
            {"tree": str(tree.id), "type": "observation", "title": "Chancre"},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["occurred_on"] is not None


# ===========================================================================
# 6. Harvests
# ===========================================================================


@pytest.mark.django_db
class TestHarvests:
    def test_several_pickings_per_season_are_kept_apart(self):
        """One picks an apple tree over three weekends — folding them into one
        row would lose the only thing the household observed."""
        hh, owner, zone = _setup()
        tree = TreeFactory(household=hh, zone=zone, created_by=owner)
        client = _client_for(owner)

        for day, qty in (("2026-09-12", "8.500"), ("2026-09-20", "12.000")):
            response = client.post(
                reverse("orchard-harvest-list"),
                {"tree": str(tree.id), "harvested_on": day, "quantity": qty, "unit": "kg"},
                format="json",
            )
            assert response.status_code == status.HTTP_201_CREATED

        assert Harvest.objects.filter(tree=tree).count() == 2

    def test_a_zero_or_negative_quantity_is_refused(self):
        hh, owner, zone = _setup()
        tree = TreeFactory(household=hh, zone=zone, created_by=owner)
        client = _client_for(owner)
        for bad in ("0", "-3.5"):
            response = client.post(
                reverse("orchard-harvest-list"),
                {"tree": str(tree.id), "quantity": bad, "unit": "kg"},
                format="json",
            )
            assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_season_is_exposed_and_filterable(self):
        hh, owner, zone = _setup()
        tree = TreeFactory(household=hh, zone=zone, created_by=owner)
        HarvestFactory(
            household=hh, tree=tree, created_by=owner, harvested_on=date(2025, 9, 1)
        )
        HarvestFactory(
            household=hh, tree=tree, created_by=owner, harvested_on=date(2026, 9, 1)
        )
        response = _client_for(owner).get(
            reverse("orchard-harvest-list"), {"season": "2026"}
        )
        assert len(response.data) == 1
        assert response.data[0]["season"] == 2026

    def test_another_household_sees_nothing(self):
        hh, owner, zone = _setup()
        tree = TreeFactory(household=hh, zone=zone, created_by=owner)
        HarvestFactory(household=hh, tree=tree, created_by=owner)

        other_hh = HouseholdFactory()
        stranger = _make_owner(other_hh)
        response = _client_for(stranger).get(reverse("orchard-harvest-list"))
        assert response.data == []


@pytest.mark.django_db
class TestDeclaringWhatASubjectCost:
    """ORCH-09 — the money has one write path, and the orchard uses it."""

    def test_it_creates_an_expense_through_the_shared_service(self):
        from interactions.models import Interaction

        hh, owner, zone = _setup()
        tree = TreeFactory(household=hh, zone=zone, created_by=owner, name="Le gros pommier")

        response = _client_for(owner).post(
            reverse("orchard-tree-purchase", args=[tree.id]),
            {"amount": "39.00", "supplier": "Pépinière du coin"},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED

        interaction = Interaction.objects.get(id=response.data["interaction_id"])
        # The queried money fields are real columns, never JSON.
        assert interaction.amount == Decimal("39.00")
        assert interaction.kind == "orchard_purchase"
        assert interaction.supplier == "Pépinière du coin"
        assert interaction.source == tree
        # The subject's zone rides along, so the expense is placed like the tree.
        assert zone in interaction.zones.all()
