"""Tests for the renovation log endpoints (parcours 13).

Covers:
  - POST   /api/interactions/interactions/renovation/         (interaction-renovation-create)
  - PATCH  /api/interactions/interactions/{id}/renovation/    (interaction-renovation-update)
  - Service create_renovation_interaction / update / delete
  - Agent _create_renovation_from_agent parity with REST endpoint
  - Cross-household isolation (multi-tenant security)
"""
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdMember
from interactions.models import Interaction
from interactions.services import (
    create_renovation_interaction,
    update_renovation_interaction,
    delete_renovation_interaction,
    RENOVATION_ELEMENTS,
    RENOVATION_TYPES,
)
from zones.models import Zone


# ---------------------------------------------------------------------------
# Shared helpers (mirror the pattern in test_api_expense_manual.py)
# ---------------------------------------------------------------------------


def _create_household(name: str) -> Household:
    return Household.objects.create(name=name)


def _add_membership(user, household, role=HouseholdMember.Role.OWNER):
    return HouseholdMember.objects.create(user=user, household=household, role=role)


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def owner(db):
    return UserFactory(email="reno-owner@example.com")


@pytest.fixture
def household(db, owner):
    instance = _create_household("Reno House")
    _add_membership(owner, instance, role=HouseholdMember.Role.OWNER)
    owner.active_household = instance
    owner.save(update_fields=["active_household"])
    return instance


@pytest.fixture
def member(db, household):
    user = UserFactory(email="reno-member@example.com")
    _add_membership(user, household, role=HouseholdMember.Role.MEMBER)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user


@pytest.fixture
def owner_client(owner):
    return _client_for(owner)


@pytest.fixture
def member_client(member):
    return _client_for(member)


@pytest.fixture
def zone(household, owner):
    return Zone.objects.create(household=household, name="Living Room", created_by=owner)


@pytest.fixture
def zone2(household, owner):
    return Zone.objects.create(household=household, name="Bedroom", created_by=owner)


@pytest.fixture
def other_household(db, owner):
    """A second household the owner is NOT a member of."""
    return _create_household("Other House")


@pytest.fixture
def other_zone(other_household, owner):
    return Zone.objects.create(
        household=other_household, name="Foreign Zone", created_by=owner
    )


# ---------------------------------------------------------------------------
# Service-level tests: create_renovation_interaction
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestCreateRenovationInteractionService:
    """Unit tests for services.create_renovation_interaction."""

    def test_creates_interaction_with_correct_fields(self, owner, household, zone):
        interaction = create_renovation_interaction(
            household=household,
            user=owner,
            element="paint",
            product="Dulux White",
            brand="Dulux",
            reference="DX-001",
            interaction_type="installation",
            zone_ids=[zone.id],
        )

        assert interaction.type == "installation"
        assert interaction.household_id == household.id
        assert interaction.created_by == owner
        assert interaction.metadata["kind"] == "renovation"
        assert interaction.metadata["element"] == "paint"
        assert interaction.metadata["product"] == "Dulux White"
        assert interaction.metadata["brand"] == "Dulux"
        assert interaction.metadata["reference"] == "DX-001"

    def test_auto_subject_composed_from_element_and_first_zone(self, owner, household, zone):
        interaction = create_renovation_interaction(
            household=household,
            user=owner,
            element="floor",
            zone_ids=[zone.id],
        )
        # Auto-subject: "<element_label> — <zone_name>"
        assert "Living Room" in interaction.subject

    def test_explicit_subject_takes_precedence(self, owner, household, zone):
        interaction = create_renovation_interaction(
            household=household,
            user=owner,
            element="floor",
            subject="My Custom Title",
            zone_ids=[zone.id],
        )
        assert interaction.subject == "My Custom Title"

    def test_zone_is_attached_via_m2m(self, owner, household, zone):
        interaction = create_renovation_interaction(
            household=household,
            user=owner,
            element="wall",
            zone_ids=[zone.id],
        )
        zone_ids = list(interaction.zones.values_list("id", flat=True))
        assert zone.id in zone_ids

    def test_multi_zone_attachment(self, owner, household, zone, zone2):
        interaction = create_renovation_interaction(
            household=household,
            user=owner,
            element="joinery",
            zone_ids=[zone.id, zone2.id],
        )
        attached_ids = set(interaction.zones.values_list("id", flat=True))
        assert {zone.id, zone2.id} == attached_ids

    def test_notes_stored_as_content(self, owner, household, zone):
        interaction = create_renovation_interaction(
            household=household,
            user=owner,
            element="ceiling",
            notes="Two coats required",
            zone_ids=[zone.id],
        )
        assert interaction.content == "Two coats required"

    def test_all_valid_elements_accepted(self, owner, household, zone):
        for element in RENOVATION_ELEMENTS:
            interaction = create_renovation_interaction(
                household=household,
                user=owner,
                element=element,
                zone_ids=[zone.id],
            )
            assert interaction.metadata["element"] == element

    def test_all_valid_interaction_types_accepted(self, owner, household, zone):
        for rtype in RENOVATION_TYPES:
            interaction = create_renovation_interaction(
                household=household,
                user=owner,
                element="paint",
                interaction_type=rtype,
                zone_ids=[zone.id],
            )
            assert interaction.type == rtype

    def test_invalid_element_raises_value_error(self, owner, household, zone):
        with pytest.raises(ValueError, match="unknown renovation element"):
            create_renovation_interaction(
                household=household,
                user=owner,
                element="roof",  # not a valid element
                zone_ids=[zone.id],
            )

    def test_invalid_interaction_type_raises_value_error(self, owner, household, zone):
        with pytest.raises(ValueError, match="unsupported renovation type"):
            create_renovation_interaction(
                household=household,
                user=owner,
                element="paint",
                interaction_type="demolition",  # not a valid type
                zone_ids=[zone.id],
            )

    def test_zone_from_other_household_raises_value_error(
        self, owner, household, other_zone
    ):
        with pytest.raises(ValueError, match="do not belong to the household"):
            create_renovation_interaction(
                household=household,
                user=owner,
                element="paint",
                zone_ids=[other_zone.id],
            )

    def test_empty_zone_ids_raises_value_error(self, owner, household):
        with pytest.raises(ValueError, match="at least one zone"):
            create_renovation_interaction(
                household=household,
                user=owner,
                element="paint",
                zone_ids=[],
            )

    def test_none_zone_ids_raises_value_error(self, owner, household):
        with pytest.raises(ValueError, match="at least one zone"):
            create_renovation_interaction(
                household=household,
                user=owner,
                element="paint",
                zone_ids=None,
            )

    def test_extra_metadata_is_merged(self, owner, household, zone):
        interaction = create_renovation_interaction(
            household=household,
            user=owner,
            element="paint",
            zone_ids=[zone.id],
            extra_metadata={"warranty_months": "24"},
        )
        assert interaction.metadata["kind"] == "renovation"
        assert interaction.metadata["warranty_months"] == "24"

    def test_default_interaction_type_is_installation(self, owner, household, zone):
        interaction = create_renovation_interaction(
            household=household,
            user=owner,
            element="heating",
            zone_ids=[zone.id],
        )
        assert interaction.type == "installation"


# ---------------------------------------------------------------------------
# Service-level tests: update_renovation_interaction
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestUpdateRenovationInteractionService:
    """Unit tests for services.update_renovation_interaction."""

    def _make_entry(self, owner, household, zone, **kwargs):
        return create_renovation_interaction(
            household=household,
            user=owner,
            element=kwargs.get("element", "paint"),
            zone_ids=kwargs.get("zone_ids", [zone.id]),
        )

    def test_updates_element_in_metadata(self, owner, household, zone):
        entry = self._make_entry(owner, household, zone)
        updated = update_renovation_interaction(
            household=household,
            user=owner,
            interaction=entry,
            fields={"element": "floor"},
        )
        assert updated.metadata["element"] == "floor"
        db_entry = Interaction.objects.get(id=entry.id)
        assert db_entry.metadata["element"] == "floor"

    def test_updates_product_brand_reference(self, owner, household, zone):
        entry = self._make_entry(owner, household, zone)
        update_renovation_interaction(
            household=household,
            user=owner,
            interaction=entry,
            fields={"product": "P1", "brand": "B1", "reference": "R1"},
        )
        db = Interaction.objects.get(id=entry.id)
        assert db.metadata["product"] == "P1"
        assert db.metadata["brand"] == "B1"
        assert db.metadata["reference"] == "R1"

    def test_updates_interaction_type(self, owner, household, zone):
        entry = self._make_entry(owner, household, zone)
        update_renovation_interaction(
            household=household,
            user=owner,
            interaction=entry,
            fields={"interaction_type": "repair"},
        )
        db = Interaction.objects.get(id=entry.id)
        assert db.type == "repair"

    def test_updates_subject(self, owner, household, zone):
        entry = self._make_entry(owner, household, zone)
        update_renovation_interaction(
            household=household,
            user=owner,
            interaction=entry,
            fields={"subject": "Updated title"},
        )
        db = Interaction.objects.get(id=entry.id)
        assert db.subject == "Updated title"

    def test_updates_notes(self, owner, household, zone):
        entry = self._make_entry(owner, household, zone)
        update_renovation_interaction(
            household=household,
            user=owner,
            interaction=entry,
            fields={"notes": "Updated notes"},
        )
        db = Interaction.objects.get(id=entry.id)
        assert db.content == "Updated notes"

    def test_resyncs_zones_when_zone_ids_provided(self, owner, household, zone, zone2):
        entry = self._make_entry(owner, household, zone)
        assert zone.id in set(entry.zones.values_list("id", flat=True))

        update_renovation_interaction(
            household=household,
            user=owner,
            interaction=entry,
            fields={},
            zone_ids=[zone2.id],
        )
        db = Interaction.objects.get(id=entry.id)
        attached = set(db.zones.values_list("id", flat=True))
        assert attached == {zone2.id}

    def test_leaves_zones_unchanged_when_zone_ids_is_none(self, owner, household, zone):
        entry = self._make_entry(owner, household, zone)
        update_renovation_interaction(
            household=household,
            user=owner,
            interaction=entry,
            fields={},
            zone_ids=None,
        )
        db = Interaction.objects.get(id=entry.id)
        assert zone.id in set(db.zones.values_list("id", flat=True))

    def test_rejects_non_renovation_entry(self, owner, household, zone):
        from django.utils import timezone

        note = Interaction.objects.create(
            household=household,
            created_by=owner,
            subject="A note",
            type="note",
            occurred_at=timezone.now(),
            metadata={},
        )
        with pytest.raises(ValueError, match="not a renovation entry"):
            update_renovation_interaction(
                household=household,
                user=owner,
                interaction=note,
                fields={},
            )

    def test_rejects_entry_from_other_household(self, owner, household, other_household, zone):
        entry = create_renovation_interaction(
            household=household,
            user=owner,
            element="paint",
            zone_ids=[zone.id],
        )
        with pytest.raises(ValueError, match="belongs to another household"):
            update_renovation_interaction(
                household=other_household,
                user=owner,
                interaction=entry,
                fields={},
            )

    def test_blank_subject_raises_value_error(self, owner, household, zone):
        entry = self._make_entry(owner, household, zone)
        with pytest.raises(ValueError, match="subject cannot be blank"):
            update_renovation_interaction(
                household=household,
                user=owner,
                interaction=entry,
                fields={"subject": "   "},
            )

    def test_invalid_element_raises_value_error(self, owner, household, zone):
        entry = self._make_entry(owner, household, zone)
        with pytest.raises(ValueError, match="unknown renovation element"):
            update_renovation_interaction(
                household=household,
                user=owner,
                interaction=entry,
                fields={"element": "roof"},
            )

    def test_invalid_type_raises_value_error(self, owner, household, zone):
        entry = self._make_entry(owner, household, zone)
        with pytest.raises(ValueError, match="unsupported renovation type"):
            update_renovation_interaction(
                household=household,
                user=owner,
                interaction=entry,
                fields={"interaction_type": "demolition"},
            )


# ---------------------------------------------------------------------------
# Service-level tests: delete_renovation_interaction
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestDeleteRenovationInteractionService:
    """Unit tests for services.delete_renovation_interaction."""

    def test_deletes_entry(self, owner, household, zone):
        entry = create_renovation_interaction(
            household=household,
            user=owner,
            element="paint",
            zone_ids=[zone.id],
        )
        entry_id = entry.id
        delete_renovation_interaction(household=household, user=owner, interaction=entry)
        assert not Interaction.objects.filter(id=entry_id).exists()

    def test_rejects_non_renovation_entry(self, owner, household):
        from django.utils import timezone

        note = Interaction.objects.create(
            household=household,
            created_by=owner,
            subject="A note",
            type="note",
            occurred_at=timezone.now(),
            metadata={},
        )
        with pytest.raises(ValueError, match="not a renovation entry"):
            delete_renovation_interaction(
                household=household, user=owner, interaction=note
            )

    def test_rejects_entry_from_other_household(self, owner, household, other_household, zone):
        entry = create_renovation_interaction(
            household=household,
            user=owner,
            element="paint",
            zone_ids=[zone.id],
        )
        with pytest.raises(ValueError, match="belongs to another household"):
            delete_renovation_interaction(
                household=other_household, user=owner, interaction=entry
            )


# ---------------------------------------------------------------------------
# REST API tests: POST /api/interactions/interactions/renovation/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestRenovationCreate:
    """POST renovation/ — happy path, validation, permissions, isolation."""

    def _url(self):
        return reverse("interaction-renovation-create")

    def _payload(self, zone_id, **overrides):
        base = {
            "element": "paint",
            "interaction_type": "installation",
            "product": "Dulux White",
            "brand": "Dulux",
            "reference": "DX-001",
            "notes": "Two coats",
            "zone_ids": [str(zone_id)],
        }
        base.update(overrides)
        return base

    # Happy path
    def test_owner_can_create(self, owner_client, household, zone):
        payload = self._payload(zone.id)
        response = owner_client.post(self._url(), data=payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED, response.content
        data = response.data
        assert data["type"] == "installation"
        assert data["metadata"]["kind"] == "renovation"
        assert data["metadata"]["element"] == "paint"
        assert data["metadata"]["product"] == "Dulux White"
        assert data["metadata"]["brand"] == "Dulux"
        assert data["metadata"]["reference"] == "DX-001"

    # DB state after creation
    def test_db_state_after_create(self, owner_client, household, zone, owner):
        payload = self._payload(zone.id, element="floor")
        response = owner_client.post(self._url(), data=payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        interaction = Interaction.objects.get(id=response.data["id"])
        assert interaction.household_id == household.id
        assert interaction.created_by == owner
        assert interaction.type == "installation"
        assert interaction.metadata["kind"] == "renovation"
        assert interaction.metadata["element"] == "floor"
        zone_ids = list(interaction.zones.values_list("id", flat=True))
        assert zone.id in zone_ids

    # Response includes zone fields
    def test_response_includes_zone_id_list_and_zone_names(
        self, owner_client, household, zone
    ):
        payload = self._payload(zone.id)
        response = owner_client.post(self._url(), data=payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert "zone_id_list" in response.data
        assert "zone_names" in response.data
        assert str(zone.id) in [str(zid) for zid in response.data["zone_id_list"]]

    # Auto-subject when omitted
    def test_auto_subject_composed_from_element_and_zone(
        self, owner_client, household, zone
    ):
        payload = self._payload(zone.id)
        payload.pop("subject", None)
        response = owner_client.post(self._url(), data=payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert "Living Room" in response.data["subject"]

    # Explicit subject stored verbatim
    def test_explicit_subject_stored_verbatim(self, owner_client, household, zone):
        payload = self._payload(zone.id, subject="Custom title")
        response = owner_client.post(self._url(), data=payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["subject"] == "Custom title"

    # Multi-zone
    def test_multi_zone_attachment(self, owner_client, household, zone, zone2):
        payload = self._payload(zone.id)
        payload["zone_ids"] = [str(zone.id), str(zone2.id)]
        response = owner_client.post(self._url(), data=payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        interaction = Interaction.objects.get(id=response.data["id"])
        attached = set(str(zid) for zid in interaction.zones.values_list("id", flat=True))
        assert {str(zone.id), str(zone2.id)} == attached

    # Member can also create (household membership allows it)
    def test_member_can_create(self, member_client, household, zone):
        payload = self._payload(zone.id)
        response = member_client.post(self._url(), data=payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED

    # Anonymous → 401
    def test_anonymous_gets_401(self, household, zone):
        client = APIClient()
        payload = self._payload(zone.id)
        response = client.post(self._url(), data=payload, format="json")
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    # Validation: element required
    def test_missing_element_returns_400(self, owner_client, household, zone):
        payload = self._payload(zone.id)
        del payload["element"]
        response = owner_client.post(self._url(), data=payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "element" in response.data

    # Validation: invalid element
    def test_invalid_element_returns_400(self, owner_client, household, zone):
        payload = self._payload(zone.id, element="roof")
        response = owner_client.post(self._url(), data=payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "element" in response.data

    # Validation: invalid interaction_type
    def test_invalid_interaction_type_returns_400(self, owner_client, household, zone):
        payload = self._payload(zone.id, interaction_type="demolition")
        response = owner_client.post(self._url(), data=payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "interaction_type" in response.data

    # Validation: zone_ids required
    def test_missing_zone_ids_returns_400(self, owner_client, household):
        payload = {
            "element": "paint",
            "interaction_type": "installation",
        }
        response = owner_client.post(self._url(), data=payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "zone_ids" in response.data

    # Validation: empty zone_ids
    def test_empty_zone_ids_returns_400(self, owner_client, household):
        payload = {
            "element": "paint",
            "interaction_type": "installation",
            "zone_ids": [],
        }
        response = owner_client.post(self._url(), data=payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "zone_ids" in response.data

    # Cross-household isolation: zone from another household rejected
    def test_zone_from_other_household_rejected(
        self, owner_client, household, other_zone
    ):
        payload = self._payload(other_zone.id)
        response = owner_client.post(self._url(), data=payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    # Cross-household isolation: user from another household cannot see this data
    def test_user_from_other_household_sees_no_data(
        self, household, zone, owner
    ):
        """A user not in `household` gets 0 renovation results, not cross-household data."""
        # Create a renovation in the main household
        create_renovation_interaction(
            household=household, user=owner, element="paint", zone_ids=[zone.id]
        )

        other_house = _create_household("Intruder House")
        intruder = UserFactory(email="intruder@example.com")
        _add_membership(intruder, other_house)
        intruder.active_household = other_house
        intruder.save(update_fields=["active_household"])

        intruder_client = _client_for(intruder)
        list_url = reverse("interaction-list") + "?kind=renovation"
        response = intruder_client.get(list_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 0


# ---------------------------------------------------------------------------
# REST API tests: PATCH /api/interactions/interactions/{id}/renovation/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestRenovationUpdate:
    """PATCH renovation/{id}/ — happy path, validation, permissions, isolation."""

    def _create_entry(self, household, owner, zone, **kwargs):
        return create_renovation_interaction(
            household=household,
            user=owner,
            element=kwargs.get("element", "paint"),
            zone_ids=kwargs.get("zone_ids", [zone.id]),
        )

    def _url(self, interaction_id):
        return reverse("interaction-renovation-update", kwargs={"pk": interaction_id})

    # Happy path
    def test_owner_can_update_element(self, owner_client, household, owner, zone):
        entry = self._create_entry(household, owner, zone)
        response = owner_client.patch(
            self._url(entry.id),
            data={"element": "floor"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        db = Interaction.objects.get(id=entry.id)
        assert db.metadata["element"] == "floor"

    def test_update_product_brand_reference(self, owner_client, household, owner, zone):
        entry = self._create_entry(household, owner, zone)
        response = owner_client.patch(
            self._url(entry.id),
            data={"product": "P2", "brand": "B2", "reference": "R2"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        db = Interaction.objects.get(id=entry.id)
        assert db.metadata["product"] == "P2"
        assert db.metadata["brand"] == "B2"
        assert db.metadata["reference"] == "R2"

    def test_update_interaction_type(self, owner_client, household, owner, zone):
        entry = self._create_entry(household, owner, zone)
        response = owner_client.patch(
            self._url(entry.id),
            data={"interaction_type": "repair"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        db = Interaction.objects.get(id=entry.id)
        assert db.type == "repair"

    def test_update_zones(self, owner_client, household, owner, zone, zone2):
        entry = self._create_entry(household, owner, zone)
        response = owner_client.patch(
            self._url(entry.id),
            data={"zone_ids": [str(zone2.id)]},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        db = Interaction.objects.get(id=entry.id)
        attached = set(db.zones.values_list("id", flat=True))
        assert attached == {zone2.id}

    def test_partial_update_leaves_other_fields_intact(
        self, owner_client, household, owner, zone
    ):
        entry = self._create_entry(household, owner, zone, element="paint")
        original_subject = entry.subject
        response = owner_client.patch(
            self._url(entry.id),
            data={"product": "Updated product"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        db = Interaction.objects.get(id=entry.id)
        # element and subject unchanged
        assert db.metadata["element"] == "paint"
        assert db.subject == original_subject

    # Anonymous → 401
    def test_anonymous_gets_401(self, household, owner, zone):
        entry = self._create_entry(household, owner, zone)
        client = APIClient()
        response = client.patch(
            self._url(entry.id),
            data={"product": "X"},
            format="json",
        )
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    # Validation: invalid element
    def test_invalid_element_returns_400(self, owner_client, household, owner, zone):
        entry = self._create_entry(household, owner, zone)
        response = owner_client.patch(
            self._url(entry.id),
            data={"element": "roof"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "element" in response.data

    # Validation: invalid interaction_type
    def test_invalid_interaction_type_returns_400(
        self, owner_client, household, owner, zone
    ):
        entry = self._create_entry(household, owner, zone)
        response = owner_client.patch(
            self._url(entry.id),
            data={"interaction_type": "demolition"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "interaction_type" in response.data

    # Cross-household isolation: another user cannot PATCH an entry they don't own
    def test_user_from_other_household_gets_404(
        self, household, owner, zone
    ):
        entry = self._create_entry(household, owner, zone)

        other_house = _create_household("Other PATCH House")
        intruder = UserFactory(email="patch-intruder@example.com")
        _add_membership(intruder, other_house)
        intruder.active_household = other_house
        intruder.save(update_fields=["active_household"])
        intruder_client = _client_for(intruder)

        response = intruder_client.patch(
            self._url(entry.id),
            data={"product": "Hacked"},
            format="json",
        )
        # Either 403 or 404 — both acceptable; the key is no data leakage
        assert response.status_code in (
            status.HTTP_403_FORBIDDEN,
            status.HTTP_404_NOT_FOUND,
        )
        # DB must remain unchanged
        db = Interaction.objects.get(id=entry.id)
        assert db.metadata.get("product", "") != "Hacked"


# ---------------------------------------------------------------------------
# REST API: filter by kind=renovation
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestRenovationFilter:
    """GET interaction-list?kind=renovation only returns renovation entries."""

    def test_filter_by_kind_returns_only_renovation(
        self, owner_client, household, owner, zone
    ):
        from django.utils import timezone

        # One renovation + one note
        create_renovation_interaction(
            household=household, user=owner, element="paint", zone_ids=[zone.id]
        )
        Interaction.objects.create(
            household=household,
            created_by=owner,
            subject="A note",
            type="note",
            occurred_at=timezone.now(),
            metadata={},
        )

        url = reverse("interaction-list") + "?kind=renovation"
        response = owner_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        for item in response.data["results"]:
            assert item["metadata"]["kind"] == "renovation"

    def test_filter_by_zone_returns_renovation_for_that_zone(
        self, owner_client, household, owner, zone, zone2
    ):
        entry_zone1 = create_renovation_interaction(
            household=household, user=owner, element="paint", zone_ids=[zone.id]
        )
        create_renovation_interaction(
            household=household, user=owner, element="floor", zone_ids=[zone2.id]
        )

        url = reverse("interaction-list") + f"?zone={zone.id}&kind=renovation"
        response = owner_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        result_ids = [item["id"] for item in response.data["results"]]
        assert str(entry_zone1.id) in result_ids
        # zone2 entry must NOT appear
        assert all(
            str(zone2.id) not in [
                str(zid) for zid in (item.get("zone_id_list") or [])
            ]
            or item["id"] == str(entry_zone1.id)
            for item in response.data["results"]
        )


# ---------------------------------------------------------------------------
# Agent parity test: _create_renovation_from_agent vs REST endpoint
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestRenovationAgentParity:
    """Verify that the agent bridge calls the same service as the REST endpoint.

    Both paths MUST produce structurally equivalent Interaction rows:
    same type, same metadata shape (kind/element/product/brand/reference),
    same zones attached.
    """

    def test_rest_and_agent_produce_equivalent_interactions(
        self, owner, household, zone
    ):
        from interactions.apps import _create_renovation_from_agent

        # REST path
        client = _client_for(owner)
        rest_payload = {
            "element": "joinery",
            "interaction_type": "replacement",
            "product": "Oak frame",
            "brand": "WoodCo",
            "reference": "WC-42",
            "notes": "All windows replaced",
            "zone_ids": [str(zone.id)],
        }
        rest_response = client.post(
            reverse("interaction-renovation-create"),
            data=rest_payload,
            format="json",
        )
        assert rest_response.status_code == status.HTTP_201_CREATED, rest_response.content
        rest_entry = Interaction.objects.get(id=rest_response.data["id"])

        # Agent path — anchor carries the zone
        agent_fields = {
            "element": "joinery",
            "interaction_type": "replacement",
            "product": "Oak frame",
            "brand": "WoodCo",
            "reference": "WC-42",
            "notes": "All windows replaced",
            # zone_ids empty; the anchor zone will be appended by the bridge
        }
        agent_entry = _create_renovation_from_agent(
            household, owner, agent_fields, anchor=("zone", zone.id)
        )

        # Structural parity
        assert rest_entry.type == agent_entry.type
        assert rest_entry.metadata["kind"] == agent_entry.metadata["kind"]
        assert rest_entry.metadata["element"] == agent_entry.metadata["element"]
        assert rest_entry.metadata["product"] == agent_entry.metadata["product"]
        assert rest_entry.metadata["brand"] == agent_entry.metadata["brand"]
        assert rest_entry.metadata["reference"] == agent_entry.metadata["reference"]

        # Both must be attached to the same zone
        rest_zones = set(rest_entry.zones.values_list("id", flat=True))
        agent_zones = set(agent_entry.zones.values_list("id", flat=True))
        assert zone.id in rest_zones
        assert zone.id in agent_zones

    def test_anchor_zone_appended_even_when_not_in_fields(
        self, owner, household, zone
    ):
        """Anchor zone must be attached even if zone_ids is absent from fields."""
        from interactions.apps import _create_renovation_from_agent

        agent_entry = _create_renovation_from_agent(
            household,
            owner,
            {"element": "wall", "interaction_type": "upgrade"},
            anchor=("zone", zone.id),
        )
        assert zone.id in set(agent_entry.zones.values_list("id", flat=True))

    def test_agent_without_anchor_uses_zone_ids_from_fields(
        self, owner, household, zone
    ):
        """When no anchor, zone_ids in fields drives zone attachment."""
        from interactions.apps import _create_renovation_from_agent

        agent_entry = _create_renovation_from_agent(
            household,
            owner,
            {"element": "floor", "zone_ids": [zone.id]},
            anchor=None,
        )
        assert zone.id in set(agent_entry.zones.values_list("id", flat=True))

    def test_non_zone_anchor_is_ignored_by_agent_bridge(
        self, owner, household, zone
    ):
        """A project anchor must NOT be used as a zone attachment."""
        from interactions.apps import _create_renovation_from_agent

        agent_entry = _create_renovation_from_agent(
            household,
            owner,
            {"element": "paint", "zone_ids": [zone.id]},
            anchor=("project", "some-project-id"),
        )
        # Zone still comes from zone_ids in fields
        assert zone.id in set(agent_entry.zones.values_list("id", flat=True))
