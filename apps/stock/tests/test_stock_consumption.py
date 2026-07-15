"""Lot 18.1/18.3 — StockLevelReading, recalibration, inventory, consumption curve."""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone

from accounts.models import User
from households.models import Household, HouseholdMember
from stock.models import StockCategory, StockItem, StockLevelReading
from stock.services import record_inventory


@pytest.fixture
def user(db):
    return User.objects.create_user(email="conso@test.dev", password="secret")


@pytest.fixture
def household(db):
    return Household.objects.create(name="Main home")


@pytest.fixture
def membership(user, household):
    HouseholdMember.objects.create(user=user, household=household, role=HouseholdMember.Role.OWNER)


@pytest.fixture
def category(household, user):
    return StockCategory.objects.create(household=household, name="Animals", created_by=user)


@pytest.fixture
def feed(household, category, user):
    return StockItem.objects.create(
        household=household,
        category=category,
        name="Chicken feed",
        quantity=Decimal("2.000"),
        unit="kg",
        status="low_stock",
        min_quantity=Decimal("5"),
        created_by=user,
    )


def _purchase_url(item):
    return reverse("stock-item-purchase", kwargs={"pk": item.id})


def _inventory_url(item):
    return reverse("stock-item-inventory", kwargs={"pk": item.id})


def _consumption_url(item):
    return reverse("stock-item-consumption", kwargs={"pk": item.id})


def _readings(item):
    return list(StockLevelReading.objects.filter(stock_item=item).order_by("reading_at", "created_at"))


@pytest.mark.django_db
def test_purchase_without_remaining_records_single_purchase_reading(client, user, feed, membership):
    client.force_login(user)

    response = client.post(
        _purchase_url(feed),
        data={"delta": "20", "amount": "30", "brand": "Gasco"},
        content_type="application/json",
    )

    assert response.status_code == 201, response.content
    feed.refresh_from_db()
    assert feed.quantity == Decimal("22.000")  # 2 + 20, no recalibration

    readings = _readings(feed)
    assert len(readings) == 1
    assert readings[0].kind == StockLevelReading.Kind.PURCHASE
    assert readings[0].quantity == Decimal("22.000")
    # Invariant: last reading coincides with the item quantity.
    assert readings[-1].quantity == feed.quantity

    from interactions.models import Interaction

    interaction = Interaction.objects.get(id=response.json()["interaction_id"])
    assert interaction.metadata["brand"] == "Gasco"
    assert readings[0].source_interaction_id == interaction.id


@pytest.mark.django_db
def test_purchase_with_remaining_recalibrates_and_records_two_readings(client, user, feed, membership):
    client.force_login(user)

    # The item thinks it has 2 kg, but the user counted 0.5 kg left before buying.
    response = client.post(
        _purchase_url(feed),
        data={"delta": "20", "amount": "30", "remaining_before": "0.5"},
        content_type="application/json",
    )

    assert response.status_code == 201, response.content
    feed.refresh_from_db()
    assert feed.quantity == Decimal("20.500")  # 0.5 (measured) + 20 (bought)

    readings = _readings(feed)
    assert len(readings) == 2
    assert readings[0].kind == StockLevelReading.Kind.INVENTORY
    assert readings[0].quantity == Decimal("0.500")
    assert readings[1].kind == StockLevelReading.Kind.PURCHASE
    assert readings[1].quantity == Decimal("20.500")
    assert readings[-1].quantity == feed.quantity


@pytest.mark.django_db
def test_purchase_rejects_negative_remaining(client, user, feed, membership):
    client.force_login(user)

    response = client.post(
        _purchase_url(feed),
        data={"delta": "5", "remaining_before": "-1"},
        content_type="application/json",
    )

    assert response.status_code == 400
    feed.refresh_from_db()
    assert feed.quantity == Decimal("2.000")
    assert _readings(feed) == []


@pytest.mark.django_db
def test_inventory_sets_absolute_quantity_and_records_reading(client, user, feed, membership):
    client.force_login(user)

    response = client.post(
        _inventory_url(feed),
        data={"quantity": "8.5"},
        content_type="application/json",
    )

    assert response.status_code == 200, response.content
    feed.refresh_from_db()
    assert feed.quantity == Decimal("8.500")
    assert feed.status == "in_stock"  # promoted above min_quantity=5

    readings = _readings(feed)
    assert len(readings) == 1
    assert readings[0].kind == StockLevelReading.Kind.INVENTORY
    assert readings[0].quantity == Decimal("8.500")
    assert readings[-1].quantity == feed.quantity


@pytest.mark.django_db
def test_inventory_to_zero_marks_out_of_stock(client, user, feed, membership):
    client.force_login(user)

    response = client.post(
        _inventory_url(feed),
        data={"quantity": "0"},
        content_type="application/json",
    )

    assert response.status_code == 200
    feed.refresh_from_db()
    assert feed.quantity == Decimal("0.000")
    assert feed.status == "out_of_stock"


@pytest.mark.django_db
def test_inventory_rejects_negative(client, user, feed, membership):
    client.force_login(user)

    response = client.post(
        _inventory_url(feed),
        data={"quantity": "-3"},
        content_type="application/json",
    )

    assert response.status_code == 400
    feed.refresh_from_db()
    assert feed.quantity == Decimal("2.000")
    assert _readings(feed) == []


@pytest.mark.django_db
def test_inventory_requires_authentication(client, feed):
    response = client.post(
        _inventory_url(feed),
        data={"quantity": "5"},
        content_type="application/json",
    )
    assert response.status_code in (401, 403)
    assert _readings(feed) == []


@pytest.mark.django_db
def test_consumption_needs_two_points(client, user, feed, membership):
    client.force_login(user)
    record_inventory(item=feed, user=user, quantity=Decimal("10"))

    response = client.get(_consumption_url(feed))
    assert response.status_code == 200, response.content
    data = response.json()
    assert data["points_count"] == 1
    assert data["rate_per_day"] is None
    assert data["projected_depletion_date"] is None
    assert data["last_level"] == 10.0


@pytest.mark.django_db
def test_consumption_derives_rate_and_depletion(client, user, feed, membership):
    client.force_login(user)
    now = timezone.now()
    # 10 kg ten days ago, 2 kg now → 8 kg over 10 days = 0.8 kg/day.
    record_inventory(item=feed, user=user, quantity=Decimal("10"), occurred_at=now - timedelta(days=10))
    record_inventory(item=feed, user=user, quantity=Decimal("2"), occurred_at=now)

    response = client.get(_consumption_url(feed))
    assert response.status_code == 200
    data = response.json()
    assert data["points_count"] == 2
    assert data["rate_per_day"] == pytest.approx(0.8, abs=0.01)
    assert data["last_level"] == 2.0
    # 2 kg / 0.8 kg/day ≈ 2.5 days of runway → a future date.
    assert data["projected_depletion_date"] is not None
    assert data["projected_depletion_date"] > now.date().isoformat()


@pytest.mark.django_db
def test_consumption_ignores_restock_jumps(client, user, feed, membership):
    client.force_login(user)
    now = timezone.now()
    record_inventory(item=feed, user=user, quantity=Decimal("10"), occurred_at=now - timedelta(days=10))
    record_inventory(item=feed, user=user, quantity=Decimal("2"), occurred_at=now - timedelta(days=5))
    # A restock jump upward must not count as (negative) consumption.
    record_inventory(item=feed, user=user, quantity=Decimal("12"), occurred_at=now - timedelta(days=4))
    record_inventory(item=feed, user=user, quantity=Decimal("4"), occurred_at=now)

    response = client.get(_consumption_url(feed))
    data = response.json()
    # Consumed: 8 (day0→5) + 8 (day6→10) = 16 over 10 days = 1.6 kg/day.
    assert data["rate_per_day"] == pytest.approx(1.6, abs=0.01)
    assert data["points_count"] == 4
