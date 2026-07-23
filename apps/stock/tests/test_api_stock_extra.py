import pytest
from django.urls import reverse

from accounts.models import User
from households.models import Household, HouseholdMember
from notifications.models import Notification
from stock.models import StockCategory, StockItem
from zones.models import Zone


@pytest.fixture
def user(db):
    return User.objects.create_user(email="stock-extra@test.dev", password="secret")


@pytest.fixture
def household(db):
    return Household.objects.create(name="Stock extra home")


@pytest.fixture
def second_household(db):
    return Household.objects.create(name="Stock extra other home")


@pytest.fixture
def dual_membership(user, household, second_household):
    HouseholdMember.objects.create(user=user, household=household, role=HouseholdMember.Role.OWNER)
    HouseholdMember.objects.create(user=user, household=second_household, role=HouseholdMember.Role.MEMBER)


@pytest.mark.django_db
def test_stock_summary_returns_counts(client, user, household, dual_membership):
    category = StockCategory.objects.create(household=household, name="Food", created_by=user)
    StockItem.objects.create(household=household, category=category, name="Rice", quantity=0, unit="kg", status="out_of_stock", created_by=user)
    StockItem.objects.create(household=household, category=category, name="Pasta", quantity=1, min_quantity=2, unit="pcs", status="low_stock", created_by=user)

    client.force_login(user)
    response = client.get(reverse("stock-category-summary"),)

    assert response.status_code == 200
    payload = response.json()[0]
    assert payload["item_count"] == 2
    assert payload["low_stock_count"] == 1
    assert payload["out_of_stock_count"] == 1


@pytest.mark.django_db
def test_stock_adjust_emits_low_stock_notification_on_transition(client, user, household, dual_membership):
    """Crossing the min_quantity threshold sends a STOCK_LOW notification to household members."""
    category = StockCategory.objects.create(household=household, name="Food", created_by=user)
    item = StockItem.objects.create(
        household=household, category=category, name="Bread",
        quantity=5, min_quantity=2, unit="pcs", status="in_stock", created_by=user,
    )
    client.force_login(user)
    response = client.post(
        reverse("stock-item-adjust-quantity", kwargs={"pk": item.id}),
        data={"delta": -4},  # 5 - 4 = 1 ≤ 2 → low_stock
        content_type="application/json",
    )
    assert response.status_code == 200
    item.refresh_from_db()
    assert item.status == StockItem.Status.LOW_STOCK
    notifs = Notification.objects.filter(user=user, type=Notification.Type.STOCK_LOW)
    assert notifs.count() == 1
    assert notifs.first().payload["item_id"] == str(item.id)


@pytest.mark.django_db
def test_stock_adjust_emits_out_of_stock_notification_on_transition(client, user, household, dual_membership):
    """Dropping to zero sends a STOCK_OUT notification."""
    category = StockCategory.objects.create(household=household, name="Food", created_by=user)
    item = StockItem.objects.create(
        household=household, category=category, name="Eggs",
        quantity=2, min_quantity=1, unit="pcs", status="in_stock", created_by=user,
    )
    client.force_login(user)
    client.post(
        reverse("stock-item-adjust-quantity", kwargs={"pk": item.id}),
        data={"delta": -2},
        content_type="application/json",
    )
    item.refresh_from_db()
    assert item.status == StockItem.Status.OUT_OF_STOCK
    assert Notification.objects.filter(user=user, type=Notification.Type.STOCK_OUT).count() == 1


@pytest.mark.django_db
def test_stock_adjust_no_notification_when_status_unchanged(client, user, household, dual_membership):
    """Adjusting quantity without a status transition does not emit a notification."""
    category = StockCategory.objects.create(household=household, name="Food", created_by=user)
    item = StockItem.objects.create(
        household=household, category=category, name="Rice",
        quantity=10, min_quantity=2, unit="kg", status="in_stock", created_by=user,
    )
    client.force_login(user)
    client.post(
        reverse("stock-item-adjust-quantity", kwargs={"pk": item.id}),
        data={"delta": -1},  # 10 - 1 = 9, still in_stock
        content_type="application/json",
    )
    assert Notification.objects.filter(user=user).count() == 0


@pytest.mark.django_db
def test_stock_adjust_quantity_rejects_negative_result(client, user, household, dual_membership):
    category = StockCategory.objects.create(household=household, name="Food", created_by=user)
    item = StockItem.objects.create(household=household, category=category, name="Beans", quantity=1, unit="pcs", status="in_stock", created_by=user)

    client.force_login(user)
    response = client.post(
        reverse("stock-item-adjust-quantity", kwargs={"pk": item.id}),
        data={"delta": -2},
        content_type="application/json",
    )

    assert response.status_code == 400
    assert "delta" in response.json()


@pytest.mark.django_db
def test_stock_create_derives_status_ignoring_client_value(client, user, household, dual_membership):
    """Status is read-only/derived: a client-sent value is ignored, quantity wins."""
    category = StockCategory.objects.create(household=household, name="Supplies", created_by=user)
    zone = Zone.objects.create(household=household, name="Pantry", created_by=user)

    client.force_login(user)
    response = client.post(
        reverse("stock-item-list"),
        data={
            "category": str(category.id),
            "zone": str(zone.id),
            "name": "Empty on arrival",
            "quantity": 0,
            "unit": "pcs",
            "status": "in_stock",  # ignored — derived from quantity
        },
        content_type="application/json",
    )

    assert response.status_code == 201
    assert response.json()["status"] == "out_of_stock"


@pytest.mark.django_db
def test_stock_create_rejects_zone_from_other_household(client, user, household, second_household, dual_membership):
    category = StockCategory.objects.create(household=household, name="Food", created_by=user)
    foreign_zone = Zone.objects.create(household=second_household, name="Shed", created_by=user)

    client.force_login(user)
    response = client.post(
        reverse("stock-item-list"),
        data={
            "category": str(category.id),
            "zone": str(foreign_zone.id),
            "name": "Olive oil",
            "quantity": 2,
            "unit": "bottle",
            "status": "in_stock",
        },
        content_type="application/json",
    )

    assert response.status_code == 400
    assert "zone" in response.json()
