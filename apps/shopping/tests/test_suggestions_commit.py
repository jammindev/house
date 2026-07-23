"""REST + service tests for shopping list Lots 3 (suggestions) and 4 (commit-to-stock).

Coverage:
- Suggestions list low/out-of-stock items not already on the list, not dismissed.
- Dismissal hides a suggestion until the item is restocked and drops low again.
- Commit of a linked line records a purchase (reincrements stock + expense) and
  removes the line; commit of a free-text line creates the stock item first.
- Permissions / household scoping throughout.
"""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from households.models import Household, HouseholdMember
from interactions.models import Interaction
from shopping.models import ShoppingListItem, ShoppingSuggestionDismissal
from shopping.services import add_stock_item_to_list, create_list_item
from stock.models import StockCategory, StockItem


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_user(email):
    return User.objects.create_user(email=email, password="pass1234")


def _add_member(user, household, role=HouseholdMember.Role.OWNER):
    HouseholdMember.objects.create(user=user, household=household, role=role)
    user.active_household = household
    user.save(update_fields=["active_household"])


def _client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _category(household, user):
    return StockCategory.objects.get_or_create(
        household=household, name="Food", defaults={"created_by": user}
    )[0]


def _stock(household, user, name, status="low_stock", quantity=Decimal("1"),
           min_quantity=Decimal("5"), max_quantity=None, last_restocked_at=None):
    return StockItem.objects.create(
        household=household, category=_category(household, user), name=name,
        quantity=quantity, unit="kg", min_quantity=min_quantity, max_quantity=max_quantity,
        status=status, last_restocked_at=last_restocked_at, created_by=user,
    )


@pytest.fixture
def owner(db):
    return _make_user("sc-owner@test.dev")


@pytest.fixture
def household(db, owner):
    hh = Household.objects.create(name="SC House")
    _add_member(owner, hh)
    return hh


# ── Lot 3: suggestions ──────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestSuggestions:
    def test_lists_low_and_out_not_in_stock(self, household, owner):
        low = _stock(household, owner, "Café", status="low_stock", quantity=1, min_quantity=5, max_quantity=10)
        out = _stock(household, owner, "Sucre", status="out_of_stock", quantity=0, min_quantity=2)
        _stock(household, owner, "Sel", status="in_stock", quantity=9, min_quantity=1)

        resp = _client_for(owner).get("/api/shopping/items/suggestions/")
        assert resp.status_code == status.HTTP_200_OK
        names = {r["name"] for r in resp.data}
        assert names == {"Café", "Sucre"}
        by_name = {r["name"]: r for r in resp.data}
        # refill up to max (10 - 1 = 9); out-of-stock falls back to the min (2)
        assert by_name["Café"]["suggested_quantity"] == "9.000"
        assert by_name["Sucre"]["suggested_quantity"] == "2.000"

    def test_excludes_items_already_on_the_list(self, household, owner):
        low = _stock(household, owner, "Café")
        add_stock_item_to_list(household, owner, low)  # now on the list
        resp = _client_for(owner).get("/api/shopping/items/suggestions/")
        assert [r["name"] for r in resp.data] == []

    def test_excludes_picked_lines_too(self, household, owner):
        low = _stock(household, owner, "Café")
        item, _ = add_stock_item_to_list(household, owner, low)
        item.checked_at = timezone.now()
        item.save(update_fields=["checked_at"])
        resp = _client_for(owner).get("/api/shopping/items/suggestions/")
        assert [r["name"] for r in resp.data] == []

    def test_dismiss_hides_suggestion(self, household, owner):
        low = _stock(household, owner, "Café")
        resp = _client_for(owner).post(
            "/api/shopping/items/suggestions/dismiss/", {"stock_item": str(low.id)}, format="json"
        )
        assert resp.status_code == status.HTTP_204_NO_CONTENT
        assert ShoppingSuggestionDismissal.objects.filter(household=household, stock_item=low).exists()
        assert _client_for(owner).get("/api/shopping/items/suggestions/").data == []

    def test_dismissal_resets_after_restock(self, household, owner):
        low = _stock(household, owner, "Café")
        _client_for(owner).post(
            "/api/shopping/items/suggestions/dismiss/", {"stock_item": str(low.id)}, format="json"
        )
        # Restock happening AFTER the dismissal makes it stale → re-suggested.
        low.last_restocked_at = timezone.now() + timedelta(minutes=1)
        low.save(update_fields=["last_restocked_at"])
        resp = _client_for(owner).get("/api/shopping/items/suggestions/")
        assert [r["name"] for r in resp.data] == ["Café"]

    def test_dismiss_requires_stock_item(self, household, owner):
        resp = _client_for(owner).post("/api/shopping/items/suggestions/dismiss/", {}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_scoped_to_household(self, household, owner):
        _stock(household, owner, "Café")
        other_owner = _make_user("sc-other@test.dev")
        other_hh = Household.objects.create(name="Other")
        _add_member(other_owner, other_hh)
        assert _client_for(other_owner).get("/api/shopping/items/suggestions/").data == []


# ── Lot 4: commit-to-stock ───────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCommitToStock:
    def _commit(self, user, item, **body):
        return _client_for(user).post(
            f"/api/shopping/items/{item.id}/commit-to-stock/", body, format="json"
        )

    def test_commit_linked_line_records_purchase(self, household, owner):
        stock = _stock(household, owner, "Café", quantity=Decimal("1"))
        item, _ = add_stock_item_to_list(household, owner, stock)
        resp = self._commit(owner, item, delta=5, amount="10.00", supplier="Biocoop")
        assert resp.status_code == status.HTTP_200_OK

        stock.refresh_from_db()
        assert stock.quantity == Decimal("6.000")  # 1 + 5
        # the line is gone, an expense interaction was created for the item
        assert not ShoppingListItem.objects.filter(id=item.id).exists()
        assert Interaction.objects.filter(
            household=household, type="expense", source_object_id=stock.id
        ).exists()

    def test_commit_free_text_creates_stock_item(self, household, owner):
        category = _category(household, owner)
        item = create_list_item(household, owner, label="Piles AA", unit="unit")
        resp = self._commit(owner, item, delta=4, amount="6.00", category=str(category.id))
        assert resp.status_code == status.HTTP_200_OK

        created = StockItem.objects.get(household=household, name="Piles AA")
        assert created.quantity == Decimal("4.000")
        assert created.category_id == category.id
        assert not ShoppingListItem.objects.filter(id=item.id).exists()

    def test_commit_free_text_without_category_fails(self, household, owner):
        item = create_list_item(household, owner, label="Piles AA")
        resp = self._commit(owner, item, delta=4)
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert ShoppingListItem.objects.filter(id=item.id).exists()  # untouched

    def test_commit_requires_positive_delta(self, household, owner):
        stock = _stock(household, owner, "Café")
        item, _ = add_stock_item_to_list(household, owner, stock)
        resp = self._commit(owner, item, delta=0)
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert ShoppingListItem.objects.filter(id=item.id).exists()

    def test_commit_cross_household_forbidden(self, household, owner):
        stock = _stock(household, owner, "Café")
        item, _ = add_stock_item_to_list(household, owner, stock)
        other_owner = _make_user("sc-other2@test.dev")
        other_hh = Household.objects.create(name="Other2")
        _add_member(other_owner, other_hh)
        resp = self._commit(other_owner, item, delta=5)
        assert resp.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)
        assert ShoppingListItem.objects.filter(id=item.id).exists()
