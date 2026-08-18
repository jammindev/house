from datetime import date
from decimal import Decimal

import pytest
from django.contrib.contenttypes.models import ContentType
from django.urls import reverse

from accounts.models import User
from equipment.models import Equipment
from households.models import Household, HouseholdMember
from interactions.models import Interaction
from zones.models import Zone


@pytest.fixture
def user(db):
    return User.objects.create_user(email="eq-purchase@test.dev", password="secret")


@pytest.fixture
def other_user(db):
    return User.objects.create_user(email="eq-other@test.dev", password="secret")


@pytest.fixture
def household(db):
    return Household.objects.create(name="Eq home")


@pytest.fixture
def second_household(db):
    return Household.objects.create(name="Other home")


@pytest.fixture
def membership(user, household):
    HouseholdMember.objects.create(
        user=user, household=household, role=HouseholdMember.Role.OWNER
    )


@pytest.fixture
def zone(household, user):
    return Zone.objects.create(household=household, name="Workshop", created_by=user)


@pytest.fixture
def drill(household, zone, user):
    return Equipment.objects.create(
        household=household,
        zone=zone,
        name="Cordless drill",
        created_by=user,
    )


def _purchase_url(equipment):
    return reverse("equipment-register-purchase", kwargs={"pk": equipment.id})


@pytest.mark.django_db
def test_registering_an_expense_never_rewrites_the_record(client, user, household, drill, membership):
    """Une dépense liée ne touche pas à la fiche — surtout pas à sa date d'achat.

    L'action recopiait montant, fournisseur et date dans ``purchase_*`` : changer
    un joint à 12 € sur une chaudière achetée en 2015 réécrivait donc sa date
    d'achat à aujourd'hui et son prix à 12 €, sans un mot et sans retour possible.
    L'achat initial se saisit dans la fiche ; ici on n'enregistre que l'argent.
    """
    drill.purchase_price = Decimal("89.00")
    drill.purchase_vendor = "Original store"
    drill.purchase_date = date(2015, 10, 12)
    drill.save(update_fields=["purchase_price", "purchase_vendor", "purchase_date"])

    client.force_login(user)

    response = client.post(
        _purchase_url(drill),
        data={
            "amount": "199.00",
            "supplier": "ToolStore",
            "occurred_at": "2026-04-15T10:00:00Z",
            "notes": "Replacement for old drill",
        },
        content_type="application/json",
    )

    assert response.status_code == 201, response.content
    payload = response.json()
    assert payload["purchase_price"] == "89.00"
    assert payload["purchase_vendor"] == "Original store"
    assert payload["purchase_date"] == "2015-10-12"
    assert "interaction_id" in payload

    drill.refresh_from_db()
    assert drill.purchase_price == Decimal("89.00")
    assert drill.purchase_vendor == "Original store"
    assert drill.purchase_date == date(2015, 10, 12)

    interaction = Interaction.objects.get(id=payload["interaction_id"])
    assert interaction.type == "expense"
    assert interaction.source == drill
    assert interaction.source_content_type == ContentType.objects.get_for_model(Equipment)
    assert interaction.source_object_id == drill.id
    assert interaction.household_id == household.id
    assert interaction.subject == "Purchase — Cordless drill"
    assert interaction.kind == "equipment_purchase"
    assert interaction.amount == Decimal("199.00")
    assert interaction.supplier == "ToolStore"
    assert interaction.metadata["equipment_name"] == "Cordless drill"
    assert interaction.zones.count() == 1
    assert interaction.zones.first().id == drill.zone_id


@pytest.mark.django_db
def test_register_purchase_without_amount_still_creates_interaction(client, user, drill, membership):
    client.force_login(user)

    response = client.post(
        _purchase_url(drill),
        data={"notes": "Free hand-me-down"},
        content_type="application/json",
    )

    assert response.status_code == 201, response.content
    payload = response.json()
    assert payload["purchase_price"] is None
    assert "interaction_id" in payload

    interaction = Interaction.objects.get(id=payload["interaction_id"])
    assert interaction.amount is None


@pytest.mark.django_db
def test_register_purchase_isolates_between_households(client, other_user, second_household, drill):
    HouseholdMember.objects.create(
        user=other_user, household=second_household, role=HouseholdMember.Role.OWNER
    )
    client.force_login(other_user)

    response = client.post(
        _purchase_url(drill),
        data={"amount": "10"},
        content_type="application/json",
    )

    assert response.status_code in (403, 404)
    assert Interaction.objects.filter(source_object_id=drill.id).count() == 0


@pytest.mark.django_db
def test_register_purchase_requires_authentication(client, drill):
    response = client.post(
        _purchase_url(drill),
        data={"amount": "10"},
        content_type="application/json",
    )
    assert response.status_code in (401, 403)
    assert Interaction.objects.filter(source_object_id=drill.id).count() == 0
