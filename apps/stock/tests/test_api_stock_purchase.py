from decimal import Decimal

import pytest
from django.urls import reverse

from accounts.models import User
from households.models import Household, HouseholdMember
from interactions.models import Interaction
from stock.models import StockCategory, StockItem
from zones.models import Zone


@pytest.fixture
def user(db):
    return User.objects.create_user(email="purchase@test.dev", password="secret")


@pytest.fixture
def other_user(db):
    return User.objects.create_user(email="other@test.dev", password="secret")


@pytest.fixture
def household(db):
    return Household.objects.create(name="Main home")


@pytest.fixture
def second_household(db):
    return Household.objects.create(name="Other home")


@pytest.fixture
def membership(user, household):
    HouseholdMember.objects.create(user=user, household=household, role=HouseholdMember.Role.OWNER)


@pytest.fixture
def category(household, user):
    return StockCategory.objects.create(household=household, name="Heating", created_by=user)


@pytest.fixture
def zone(household, user):
    return Zone.objects.create(household=household, name="Outbuilding", created_by=user)


@pytest.fixture
def firewood(household, category, zone, user):
    return StockItem.objects.create(
        household=household,
        category=category,
        zone=zone,
        name="Firewood",
        quantity=Decimal("0"),
        unit="stere",
        status="out_of_stock",
        created_by=user,
    )


def _purchase_url(item):
    return reverse("stock-item-purchase", kwargs={"pk": item.id})


@pytest.mark.django_db
def test_purchase_increments_quantity_and_creates_expense(client, user, household, firewood, membership):
    client.force_login(user)

    response = client.post(
        _purchase_url(firewood),
        data={
            "delta": "3.800",
            "amount": "342.00",
            "supplier": "Wood Co.",
            "occurred_at": "2026-05-02T10:00:00Z",
            "notes": "Delivered to outbuilding",
        },
        content_type="application/json",
    )

    assert response.status_code == 201, response.content
    payload = response.json()
    assert payload["quantity"] == "3.800"
    assert payload["status"] == "in_stock"
    assert payload["unit_price"] == "90.00"
    assert payload["supplier"] == "Wood Co."
    assert payload["purchase_date"] == "2026-05-02"
    assert "interaction_id" in payload

    interaction = Interaction.objects.get(id=payload["interaction_id"])
    assert interaction.type == "expense"
    assert interaction.stock_item_id == firewood.id
    assert interaction.household_id == household.id
    assert interaction.created_by_id == user.id
    assert interaction.subject == "Purchase: Firewood"
    assert interaction.metadata["kind"] == "stock_purchase"
    assert interaction.metadata["stock_item_name"] == "Firewood"
    assert interaction.metadata["amount"] == "342.00"
    assert interaction.metadata["unit_price"] == "90.00"
    assert interaction.metadata["delta"] == "3.800"
    assert interaction.metadata["unit"] == "stere"
    assert interaction.zones.count() == 1
    assert interaction.zones.first().id == firewood.zone_id


@pytest.mark.django_db
def test_purchase_without_amount_creates_interaction_without_unit_price(client, user, firewood, membership):
    client.force_login(user)

    response = client.post(
        _purchase_url(firewood),
        data={"delta": "1"},
        content_type="application/json",
    )

    assert response.status_code == 201, response.content
    payload = response.json()
    assert payload["quantity"] == "1.000"
    assert payload["unit_price"] is None

    interaction = Interaction.objects.get(id=payload["interaction_id"])
    assert interaction.metadata["amount"] is None
    assert interaction.metadata["unit_price"] is None


@pytest.mark.django_db
def test_purchase_rejects_zero_or_negative_delta(client, user, firewood, membership):
    client.force_login(user)

    response = client.post(
        _purchase_url(firewood),
        data={"delta": "0"},
        content_type="application/json",
    )
    assert response.status_code == 400

    response = client.post(
        _purchase_url(firewood),
        data={"delta": "-2"},
        content_type="application/json",
    )
    assert response.status_code == 400

    firewood.refresh_from_db()
    assert firewood.quantity == Decimal("0")
    assert Interaction.objects.filter(stock_item=firewood).count() == 0


@pytest.mark.django_db
def test_purchase_isolates_between_households(client, other_user, second_household, firewood):
    HouseholdMember.objects.create(
        user=other_user, household=second_household, role=HouseholdMember.Role.OWNER
    )
    client.force_login(other_user)

    response = client.post(
        _purchase_url(firewood),
        data={"delta": "1", "amount": "10"},
        content_type="application/json",
    )

    assert response.status_code in (403, 404)
    firewood.refresh_from_db()
    assert firewood.quantity == Decimal("0")
    assert Interaction.objects.filter(stock_item=firewood).count() == 0


@pytest.mark.django_db
def test_purchase_requires_authentication(client, firewood):
    response = client.post(
        _purchase_url(firewood),
        data={"delta": "1"},
        content_type="application/json",
    )
    assert response.status_code in (401, 403)
    assert Interaction.objects.filter(stock_item=firewood).count() == 0


@pytest.mark.django_db
def test_purchase_promotes_status_from_out_of_stock(client, user, firewood, membership):
    assert firewood.status == "out_of_stock"
    client.force_login(user)

    response = client.post(
        _purchase_url(firewood),
        data={"delta": "2"},
        content_type="application/json",
    )

    assert response.status_code == 201
    firewood.refresh_from_db()
    assert firewood.status == "in_stock"


@pytest.mark.django_db
def test_purchase_keeps_low_stock_when_below_min(client, user, household, category, membership):
    item = StockItem.objects.create(
        household=household,
        category=category,
        name="Pellets",
        quantity=Decimal("0"),
        min_quantity=Decimal("10"),
        unit="bag",
        status="out_of_stock",
        created_by=user,
    )
    client.force_login(user)

    response = client.post(
        _purchase_url(item),
        data={"delta": "5"},
        content_type="application/json",
    )

    assert response.status_code == 201
    item.refresh_from_db()
    assert item.quantity == Decimal("5.000")
    assert item.status == "low_stock"
