import pytest
from django.urls import reverse

from accounts.models import User
from households.models import Household, HouseholdMember
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
    response = client.get(reverse("stock-category-summary"), HTTP_X_HOUSEHOLD_ID=str(household.id))

    assert response.status_code == 200
    payload = response.json()[0]
    assert payload["item_count"] == 2
    assert payload["low_stock_count"] == 1
    assert payload["out_of_stock_count"] == 1


@pytest.mark.django_db
def test_stock_adjust_quantity_rejects_negative_result(client, user, household, dual_membership):
    category = StockCategory.objects.create(household=household, name="Food", created_by=user)
    item = StockItem.objects.create(household=household, category=category, name="Beans", quantity=1, unit="pcs", status="in_stock", created_by=user)

    client.force_login(user)
    response = client.post(
        reverse("stock-item-adjust-quantity", kwargs={"pk": item.id}),
        data={"delta": -2},
        content_type="application/json",
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    assert response.status_code == 400
    assert "delta" in response.json()


@pytest.mark.django_db
def test_stock_create_ordered_item_sets_last_restocked_at(client, user, household, dual_membership):
    category = StockCategory.objects.create(household=household, name="Supplies", created_by=user)
    zone = Zone.objects.create(household=household, name="Pantry", created_by=user)

    client.force_login(user)
    response = client.post(
        reverse("stock-item-list"),
        data={
            "category": str(category.id),
            "zone": str(zone.id),
            "name": "Ordered filters",
            "quantity": 3,
            "unit": "pcs",
            "status": "ordered",
        },
        content_type="application/json",
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    assert response.status_code == 201
    created = StockItem.objects.get(id=response.json()["id"])
    assert created.last_restocked_at is not None


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
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    assert response.status_code == 400
    assert "zone" in response.json()
