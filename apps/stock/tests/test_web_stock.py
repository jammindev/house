import pytest
from django.urls import reverse

from accounts.models import User
from households.models import Household, HouseholdMember
from stock.models import StockCategory, StockItem
from zones.models import Zone


@pytest.fixture
def user(db):
    return User.objects.create_user(email="stock-web@test.dev", password="secret")


@pytest.fixture
def household(db):
    return Household.objects.create(name="Home")


@pytest.fixture
def membership(user, household):
    return HouseholdMember.objects.create(user=user, household=household, role=HouseholdMember.Role.OWNER)


@pytest.fixture
def zone(household, user):
    return Zone.objects.create(household=household, name="Kitchen", created_by=user)


@pytest.fixture
def category(household, user):
    return StockCategory.objects.create(household=household, name="Food", created_by=user)


@pytest.fixture
def item(household, category, zone, user):
    return StockItem.objects.create(
        household=household,
        category=category,
        zone=zone,
        name="Olive oil",
        quantity=2,
        unit="bottle",
        status=StockItem.Status.IN_STOCK,
        created_by=user,
    )


@pytest.mark.django_db
def test_stock_list_page_renders_with_props(client, user, household, membership):
    client.force_login(user)
    response = client.get(reverse("stock:app_equipment_stock"), HTTP_X_HOUSEHOLD_ID=str(household.id))

    assert response.status_code == 200
    assert "stock/app/stock.html" in [template.name for template in response.templates]

    assert "stock_list_props" in response.context
    props = response.context["stock_list_props"]
    assert props["newUrl"] == reverse("stock:app_equipment_stock_new")


@pytest.mark.django_db
def test_stock_new_page_renders_with_form_props(client, user, household, membership, zone, category):
    client.force_login(user)
    response = client.get(reverse("stock:app_equipment_stock_new"), HTTP_X_HOUSEHOLD_ID=str(household.id))

    assert response.status_code == 200
    assert "stock/app/stock_new.html" in [template.name for template in response.templates]

    assert "stock_form_props" in response.context
    props = response.context["stock_form_props"]
    assert props["mode"] == "create"
    assert props["cancelUrl"] == reverse("stock:app_equipment_stock")
    assert len(props["initialZones"]) == 1
    assert len(props["initialCategories"]) == 1


@pytest.mark.django_db
def test_stock_detail_and_edit_pages_render(client, user, household, membership, zone, category, item):
    client.force_login(user)

    detail_response = client.get(
        reverse("stock:app_equipment_stock_detail", kwargs={"item_id": item.id}),
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )
    assert detail_response.status_code == 200
    assert "stock/app/stock_detail.html" in [template.name for template in detail_response.templates]
    detail_props = detail_response.context["stock_detail_props"]
    assert detail_props["itemId"] == str(item.id)

    edit_response = client.get(
        reverse("stock:app_equipment_stock_edit", kwargs={"item_id": item.id}),
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )
    assert edit_response.status_code == 200
    assert "stock/app/stock_edit.html" in [template.name for template in edit_response.templates]
    form_props = edit_response.context["stock_form_props"]
    assert form_props["mode"] == "edit"
    assert form_props["itemId"] == str(item.id)
