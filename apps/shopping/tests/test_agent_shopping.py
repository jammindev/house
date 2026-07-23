"""Agent integration tests for the shopping list (apps.py WritableSpec / SearchableSpec).

Tests the anti-duplication contract: the agent's create/update/delete handlers
go through the same services as the REST API, so behaviour must match.

Coverage:
1. WritableSpec and SearchableSpec are registered with expected entity_type.
2. create_entity with a label matching an existing StockItem name → linked line
   (deduped exactly like the REST from-stock path).
3. create_entity with an unknown label → free-text line (stock_item is None).
4. create_entity is deduped: calling it twice for the same stock item returns
   the same line without a duplicate.
5. update_entity edits allowed fields (label, quantity, note, checked).
6. delete_entity removes the line; a second call raises LookupError.
7. Anchor: creating from a 'stock_item' anchor links the line to that item.
"""
from __future__ import annotations

from decimal import Decimal

import pytest

from agent import tools
from agent import writables as agent_writables
from agent import searchables as agent_searchables
from accounts.models import User
from households.models import Household, HouseholdMember
from shopping.models import ShoppingListItem
from stock.models import StockCategory, StockItem


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_user(email: str) -> User:
    return User.objects.create_user(email=email, password="pass1234")


def _make_household(name: str = "Agent Shopping House") -> Household:
    return Household.objects.create(name=name)


def _add_member(user, household, role=HouseholdMember.Role.OWNER) -> HouseholdMember:
    membership = HouseholdMember.objects.create(user=user, household=household, role=role)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return membership


def _dispatch_create(household, user, fields, *, context_entity=None):
    return tools.dispatch(
        "create_entity",
        {"entity_type": "shopping_item", "fields": fields},
        household=household,
        user=user,
        context_entity=context_entity,
    )


def _dispatch_update(household, user, item_id, fields):
    return tools.dispatch(
        "update_entity",
        {"entity_type": "shopping_item", "id": str(item_id), "fields": fields},
        household=household,
        user=user,
    )


def _dispatch_delete(household, user, item_id):
    return agent_writables.delete_created("shopping_item", household, user, str(item_id))


def _make_stock_item(household, user, name="Pasta", quantity=Decimal("2"), unit="kg",
                     min_quantity=None, max_quantity=None) -> StockItem:
    category = StockCategory.objects.get_or_create(
        household=household, name="Food", defaults={"created_by": user}
    )[0]
    return StockItem.objects.create(
        household=household,
        category=category,
        name=name,
        quantity=quantity,
        unit=unit,
        min_quantity=min_quantity,
        max_quantity=max_quantity,
        status="in_stock",
        created_by=user,
    )


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def owner(db):
    return _make_user("shopping-agent@test.dev")


@pytest.fixture
def household(db, owner):
    hh = _make_household()
    _add_member(owner, hh, role=HouseholdMember.Role.OWNER)
    return hh


@pytest.fixture
def stock_item(db, household, owner):
    return _make_stock_item(household, owner, name="Chicken feed", quantity=Decimal("2"), unit="kg")


# ── Registry ──────────────────────────────────────────────────────────────────

def test_writablespec_registered():
    spec = agent_writables.find_spec("shopping_item")
    assert spec is not None
    assert "shopping_item" in agent_writables.updatable_entity_types()
    assert agent_writables.can_delete("shopping_item")


def test_searchablespec_registered():
    spec = agent_searchables.find_spec("shopping_item")
    assert spec is not None


# ── create_entity — free-text ─────────────────────────────────────────────────

@pytest.mark.django_db
class TestAgentCreateFreeText:
    """create_entity with an unknown label → free-text line."""

    def test_creates_free_text_item(self, household, owner):
        result = _dispatch_create(household, owner, {"label": "Unknown Product"})
        assert result.created, result.rendered
        item = ShoppingListItem.objects.get(pk=result.created[0]["id"])
        assert item.household == household
        assert item.label == "Unknown Product"
        assert item.stock_item is None

    def test_free_text_with_quantity_and_unit(self, household, owner):
        result = _dispatch_create(
            household, owner, {"label": "Olive Oil", "quantity": "2", "unit": "L"}
        )
        assert result.created, result.rendered
        item = ShoppingListItem.objects.get(pk=result.created[0]["id"])
        assert item.quantity == Decimal("2")
        assert item.unit == "L"
        assert item.stock_item is None

    def test_empty_label_is_recoverable_error(self, household, owner):
        result = _dispatch_create(household, owner, {"label": ""})
        assert not result.created
        assert not ShoppingListItem.objects.filter(label="").exists()


# ── create_entity — stock item link (parity with from-stock) ──────────────────

@pytest.mark.django_db
class TestAgentCreateLinkedToStockItem:
    """create_entity with a label matching an existing StockItem name → linked + deduped."""

    def test_label_matching_stock_item_name_produces_linked_line(self, household, owner, stock_item):
        result = _dispatch_create(household, owner, {"label": "Chicken feed"})
        assert result.created, result.rendered
        item = ShoppingListItem.objects.get(pk=result.created[0]["id"])
        assert item.stock_item == stock_item

    def test_case_insensitive_match(self, household, owner, stock_item):
        result = _dispatch_create(household, owner, {"label": "CHICKEN FEED"})
        assert result.created, result.rendered
        item = ShoppingListItem.objects.get(pk=result.created[0]["id"])
        assert item.stock_item == stock_item

    def test_linked_line_is_deduped_on_second_call(self, household, owner, stock_item):
        """Calling create_entity twice for the same stock item name must NOT create a duplicate."""
        r1 = _dispatch_create(household, owner, {"label": "Chicken feed"})
        assert r1.created
        first_id = r1.created[0]["id"]

        r2 = _dispatch_create(household, owner, {"label": "Chicken feed"})
        # The agent handler always returns the item (may not have a created entry if deduped)
        # What matters: exactly one unchecked line for this stock item
        assert ShoppingListItem.objects.filter(
            stock_item=stock_item, checked_at__isnull=True
        ).count() == 1

    def test_stock_item_from_different_household_not_linked(self, household, owner):
        """An identically-named stock item in another household must NOT be linked."""
        other_owner = _make_user("other-agent2@test.dev")
        other_hh = _make_household("Other House")
        _add_member(other_owner, other_hh)
        _make_stock_item(other_hh, other_owner, name="Chicken feed")

        result = _dispatch_create(household, owner, {"label": "Chicken feed"})
        # household has no StockItem called "Chicken feed", so it should be free-text
        assert result.created, result.rendered
        item = ShoppingListItem.objects.get(pk=result.created[0]["id"])
        assert item.stock_item is None


# ── create_entity — anchor ────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAgentCreateWithAnchor:
    """Anchor on a stock_item → linked line deduped."""

    def test_anchor_links_item_regardless_of_label(self, household, owner, stock_item):
        result = _dispatch_create(
            household, owner,
            {"label": "Some other name"},
            context_entity=("stock_item", str(stock_item.id)),
        )
        assert result.created, result.rendered
        item = ShoppingListItem.objects.get(pk=result.created[0]["id"])
        assert item.stock_item == stock_item

    def test_anchor_deduped_same_as_rest_from_stock(self, household, owner, stock_item):
        """Anchor call is deduped if an unchecked line already links the stock item."""
        # Pre-create a linked unchecked line
        ShoppingListItem.objects.create(
            household=household, label=stock_item.name, stock_item=stock_item, created_by=owner
        )
        _dispatch_create(
            household, owner,
            {"label": stock_item.name},
            context_entity=("stock_item", str(stock_item.id)),
        )
        assert ShoppingListItem.objects.filter(
            stock_item=stock_item, checked_at__isnull=True
        ).count() == 1


# ── update_entity ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAgentUpdate:
    """update_entity edits allowed fields on a shopping list item."""

    def _create_item(self, household, user, label="To Update"):
        return ShoppingListItem.objects.create(
            household=household, label=label, created_by=user
        )

    def test_update_label_and_quantity(self, household, owner):
        item = self._create_item(household, owner)
        result = _dispatch_update(
            household, owner, item.id, {"label": "Updated", "quantity": "5"}
        )
        item.refresh_from_db()
        assert item.label == "Updated"
        assert item.quantity == Decimal("5")

    def test_update_checked_true_sets_checked_at(self, household, owner):
        item = self._create_item(household, owner)
        assert item.checked_at is None
        _dispatch_update(household, owner, item.id, {"checked": True})
        item.refresh_from_db()
        assert item.checked_at is not None

    def test_update_checked_false_clears_checked_at(self, household, owner):
        from django.utils import timezone as tz
        item = self._create_item(household, owner)
        item.checked_at = tz.now()
        item.save(update_fields=["checked_at"])
        _dispatch_update(household, owner, item.id, {"checked": False})
        item.refresh_from_db()
        assert item.checked_at is None

    def test_update_note(self, household, owner):
        item = self._create_item(household, owner)
        _dispatch_update(household, owner, item.id, {"note": "Don't forget!"})
        item.refresh_from_db()
        assert item.note == "Don't forget!"


# ── delete_entity ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAgentDelete:
    """delete_entity removes the shopping list item; double delete raises LookupError."""

    def _create_item(self, household, user, label="To Delete"):
        return ShoppingListItem.objects.create(
            household=household, label=label, created_by=user
        )

    def test_delete_removes_item(self, household, owner):
        item = self._create_item(household, owner)
        item_id = item.id
        _dispatch_delete(household, owner, item_id)
        assert not ShoppingListItem.objects.filter(id=item_id).exists()

    def test_double_delete_raises_lookup_error(self, household, owner):
        item = self._create_item(household, owner)
        item_id = item.id
        _dispatch_delete(household, owner, item_id)
        with pytest.raises(LookupError):
            _dispatch_delete(household, owner, item_id)

    def test_delete_from_wrong_household_raises_lookup_error(self, household, owner):
        other_owner = _make_user("other-del@test.dev")
        other_hh = _make_household("Other House Del")
        _add_member(other_owner, other_hh)
        foreign_item = self._create_item(other_hh, other_owner)
        with pytest.raises(LookupError):
            _dispatch_delete(household, owner, foreign_item.id)
        # The item must still exist
        assert ShoppingListItem.objects.filter(id=foreign_item.id).exists()
