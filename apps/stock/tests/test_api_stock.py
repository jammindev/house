import pytest
from django.urls import reverse

from accounts.models import User
from households.models import Household, HouseholdMember
from stock.models import StockCategory, StockItem
from zones.models import Zone


@pytest.fixture
def user(db):
    return User.objects.create_user(email="stock@test.dev", password="secret")


@pytest.fixture
def household(db):
    return Household.objects.create(name="Main home")


@pytest.fixture
def second_household(db):
    return Household.objects.create(name="Second home")


@pytest.fixture
def dual_membership(user, household, second_household):
    HouseholdMember.objects.create(user=user, household=household, role=HouseholdMember.Role.OWNER)
    HouseholdMember.objects.create(user=user, household=second_household, role=HouseholdMember.Role.MEMBER)


@pytest.mark.django_db
def test_stock_list_filters_by_household_and_status(client, user, household, second_household, dual_membership):
    kitchen = Zone.objects.create(household=household, name="Kitchen", created_by=user)
    pantry = Zone.objects.create(household=second_household, name="Pantry", created_by=user)

    food = StockCategory.objects.create(household=household, name="Food", created_by=user)
    tools = StockCategory.objects.create(household=second_household, name="Tools", created_by=user)

    StockItem.objects.create(
        household=household,
        category=food,
        zone=kitchen,
        name="Pasta",
        quantity=3,
        unit="pcs",
        status="in_stock",
        created_by=user,
    )
    StockItem.objects.create(
        household=household,
        category=food,
        zone=kitchen,
        name="Rice",
        quantity=0,
        unit="kg",
        status="out_of_stock",
        created_by=user,
    )
    StockItem.objects.create(
        household=second_household,
        category=tools,
        zone=pantry,
        name="Screws",
        quantity=20,
        unit="pcs",
        status="in_stock",
        created_by=user,
    )

    client.force_login(user)
    response = client.get(
        reverse("stock-item-list"),
        {"status": "in_stock"},
    )

    assert response.status_code == 200
    payload = response.json()
    names = [entry["name"] for entry in payload]
    assert names == ["Pasta"]


@pytest.mark.django_db
def test_stock_adjust_quantity_updates_status(client, user, household, dual_membership):
    category = StockCategory.objects.create(household=household, name="Food", created_by=user)
    item = StockItem.objects.create(
        household=household,
        category=category,
        name="Beans",
        quantity=5,
        min_quantity=2,
        unit="pcs",
        status="in_stock",
        created_by=user,
    )

    client.force_login(user)
    response = client.post(
        reverse("stock-item-adjust-quantity", kwargs={"pk": item.id}),
        data={"delta": -4},
        content_type="application/json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["quantity"] == "1.000"
    assert payload["status"] == "low_stock"


@pytest.mark.django_db
def test_stock_item_create_rejects_category_from_other_household(client, user, household, second_household, dual_membership):
    own_zone = Zone.objects.create(household=household, name="Kitchen", created_by=user)
    foreign_category = StockCategory.objects.create(household=second_household, name="Foreign", created_by=user)

    client.force_login(user)
    response = client.post(
        reverse("stock-item-list"),
        data={
            "category": str(foreign_category.id),
            "zone": str(own_zone.id),
            "name": "Olive oil",
            "quantity": 2,
            "unit": "bottle",
            "status": "in_stock",
        },
        content_type="application/json",
    )

    assert response.status_code == 400
    payload = response.json()
    assert "category" in payload
