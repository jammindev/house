"""Agent integration tests for stock (parcours 18, lot 18.4).

Verifies the WritableSpecs registered in stock/apps.py go through the same
services as the REST API (non-duplication) and behave correctly:

  - create_entity 'stock_item' = same DB shape as the REST serializer
  - unknown category is a recoverable error (never created silently)
  - create_entity 'stock_reading' records an inventory (absolute level)
  - create_entity 'stock_purchase' restocks + creates the expense, undoable
  - update_entity 'stock_item' edits fields (not quantity)
  - registries expose the three writables
"""
from __future__ import annotations

from decimal import Decimal

import pytest

from agent import tools
from agent import writables as agent_writables
from households.models import Household, HouseholdMember
from interactions.models import Interaction
from stock.models import StockCategory, StockItem, StockLevelReading

from accounts.models import User


def _create(household, tool_input, user=None, context_entity=None):
    return tools.dispatch(
        "create_entity", tool_input, household=household, user=user, context_entity=context_entity
    )


def _update(household, tool_input, user=None):
    return tools.dispatch("update_entity", tool_input, household=household, user=user)


@pytest.fixture
def owner(db):
    return User.objects.create_user(email="stock-agent@test.dev", password="secret")


@pytest.fixture
def household(db, owner):
    hh = Household.objects.create(name="Stock Agent House")
    HouseholdMember.objects.create(user=owner, household=hh, role=HouseholdMember.Role.OWNER)
    return hh


@pytest.fixture
def category(household, owner):
    return StockCategory.objects.create(household=household, name="Animals", created_by=owner)


@pytest.fixture
def feed(household, category, owner):
    return StockItem.objects.create(
        household=household,
        category=category,
        name="Chicken feed",
        quantity=Decimal("2.000"),
        unit="kg",
        min_quantity=Decimal("5"),
        status="low_stock",
        created_by=owner,
    )


# --- registration ------------------------------------------------------------

def test_writables_registered():
    for et in ("stock_item", "stock_reading", "stock_purchase"):
        assert agent_writables.find_spec(et) is not None
    # stock_item is updatable; the actions are not
    assert "stock_item" in agent_writables.updatable_entity_types()
    assert "stock_purchase" not in agent_writables.updatable_entity_types()
    # only the purchase is undoable
    assert agent_writables.can_delete("stock_purchase")
    assert agent_writables.can_delete("stock_item")
    assert not agent_writables.can_delete("stock_reading")


# --- create stock_item -------------------------------------------------------

@pytest.mark.django_db
def test_create_stock_item(household, owner, category):
    result = _create(
        household,
        {"entity_type": "stock_item", "fields": {"name": "Litter", "category": "Animals", "unit": "kg", "min_quantity": "5"}},
        user=owner,
    )
    assert result.created, result.rendered
    item = StockItem.objects.get(pk=result.created[0]["id"])
    assert item.household == household
    assert item.name == "Litter"
    assert item.category == category
    assert item.min_quantity == Decimal("5")
    assert "/app/stock/" in result.created[0]["url_path"]


@pytest.mark.django_db
def test_create_stock_item_unknown_category_is_recoverable(household, owner):
    result = _create(
        household,
        {"entity_type": "stock_item", "fields": {"name": "Litter", "category": "Nope"}},
        user=owner,
    )
    assert not result.created
    assert not StockItem.objects.filter(name="Litter").exists()
    assert not StockCategory.objects.filter(name="Nope").exists()  # never created silently


# --- create stock_reading (inventory) ----------------------------------------

@pytest.mark.django_db
def test_create_stock_reading_records_inventory(household, owner, feed):
    result = _create(
        household,
        {"entity_type": "stock_reading", "fields": {"stock_item": "Chicken feed", "quantity": "8"}},
        user=owner,
    )
    assert result.created, result.rendered
    feed.refresh_from_db()
    assert feed.quantity == Decimal("8.000")
    assert feed.status == "in_stock"
    reading = StockLevelReading.objects.filter(stock_item=feed).latest("reading_at")
    assert reading.kind == "inventory"
    assert reading.quantity == Decimal("8.000")


@pytest.mark.django_db
def test_stock_reading_resolves_from_anchor(household, owner, feed):
    result = _create(
        household,
        {"entity_type": "stock_reading", "fields": {"quantity": "3"}},
        user=owner,
        context_entity=("stock_item", str(feed.id)),
    )
    assert result.created, result.rendered
    feed.refresh_from_db()
    assert feed.quantity == Decimal("3.000")


# --- create stock_purchase + undo --------------------------------------------

@pytest.mark.django_db
def test_create_stock_purchase_restocks_and_records_expense(household, owner, feed):
    result = _create(
        household,
        {
            "entity_type": "stock_purchase",
            "fields": {"stock_item": "Chicken feed", "delta": "20", "amount": "30", "supplier": "Gamm Vert", "brand": "Gasco"},
        },
        user=owner,
    )
    assert result.created, result.rendered
    feed.refresh_from_db()
    assert feed.quantity == Decimal("22.000")  # 2 + 20

    interaction = Interaction.objects.get(pk=result.created[0]["id"])
    assert interaction.metadata["kind"] == "stock_purchase"
    assert interaction.metadata["brand"] == "Gasco"


@pytest.mark.django_db
def test_stock_purchase_undo_reverses_everything(household, owner, feed):
    result = _create(
        household,
        {"entity_type": "stock_purchase", "fields": {"stock_item": "Chicken feed", "delta": "20", "amount": "30"}},
        user=owner,
    )
    interaction_id = result.created[0]["id"]
    feed.refresh_from_db()
    assert feed.quantity == Decimal("22.000")

    agent_writables.delete_created("stock_purchase", household, owner, interaction_id)

    feed.refresh_from_db()
    assert feed.quantity == Decimal("2.000")  # restored
    assert not Interaction.objects.filter(pk=interaction_id).exists()
    assert not StockLevelReading.objects.filter(source_interaction_id=interaction_id).exists()

    # Double undo is idempotent (LookupError, not a crash).
    with pytest.raises(LookupError):
        agent_writables.delete_created("stock_purchase", household, owner, interaction_id)


# --- update stock_item -------------------------------------------------------

@pytest.mark.django_db
def test_update_stock_item_edits_fields(household, owner, feed):
    result = _update(
        household,
        {"entity_type": "stock_item", "id": str(feed.id), "fields": {"min_quantity": "10", "supplier": "Gamm Vert"}},
        user=owner,
    )
    assert not result.rendered.startswith("(could not")
    feed.refresh_from_db()
    assert feed.min_quantity == Decimal("10")
    assert feed.supplier == "Gamm Vert"
    assert feed.quantity == Decimal("2.000")  # unchanged
