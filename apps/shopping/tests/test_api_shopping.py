"""REST API tests for the shopping list (ShoppingListItemViewSet).

Coverage:
1. Happy-path CRUD — create free-text, list, retrieve, update, delete.
2. DB state verification after every mutation.
3. Permission checks — owner, member, anonymous (401), non-member (403/404).
4. Cross-household isolation — another household's items are invisible.
5. Validation errors — missing label, wrong types, stock item from wrong household.
6. from-stock action — dedup, suggested quantity, cross-household guard.
7. bulk-delete action — scoped to caller's household.
"""
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from households.models import Household, HouseholdMember
from shopping.models import ShoppingListItem
from stock.models import StockCategory, StockItem


# ── Shared helpers ────────────────────────────────────────────────────────────

def _make_user(email: str) -> User:
    return User.objects.create_user(email=email, password="pass1234")


def _make_household(name: str = "Test House") -> Household:
    return Household.objects.create(name=name)


def _add_member(user, household, role=HouseholdMember.Role.OWNER) -> HouseholdMember:
    """Add user to household and set it as their active household."""
    membership = HouseholdMember.objects.create(user=user, household=household, role=role)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return membership


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _anon_client() -> APIClient:
    return APIClient()


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
    return _make_user("shopping-owner@test.dev")


@pytest.fixture
def household(db, owner):
    hh = _make_household("Shopping House")
    _add_member(owner, hh, role=HouseholdMember.Role.OWNER)
    return hh


@pytest.fixture
def member(db, household):
    user = _make_user("shopping-member@test.dev")
    _add_member(user, household, role=HouseholdMember.Role.MEMBER)
    return user


@pytest.fixture
def other_owner(db):
    return _make_user("shopping-other@test.dev")


@pytest.fixture
def other_household(db, other_owner):
    hh = _make_household("Other House")
    _add_member(other_owner, hh, role=HouseholdMember.Role.OWNER)
    return hh


# ── TestShoppingItemList ───────────────────────────────────────────────────────

@pytest.mark.django_db
class TestShoppingItemList:
    """GET /api/shopping/items/ — list is household-scoped."""

    def _create_item(self, household, user, label="Milk"):
        return ShoppingListItem.objects.create(
            household=household, label=label, created_by=user
        )

    def test_owner_can_list_own_items(self, owner, household):
        self._create_item(household, owner, "Bread")
        self._create_item(household, owner, "Eggs")
        client = _client_for(owner)
        response = client.get(reverse("shopping-item-list"))
        assert response.status_code == status.HTTP_200_OK
        labels = [item["label"] for item in response.data]
        assert "Bread" in labels
        assert "Eggs" in labels

    def test_member_can_list(self, member, household, owner):
        self._create_item(household, owner, "Cheese")
        client = _client_for(member)
        response = client.get(reverse("shopping-item-list"))
        assert response.status_code == status.HTTP_200_OK
        labels = [item["label"] for item in response.data]
        assert "Cheese" in labels

    def test_anonymous_gets_401(self, household, owner):
        self._create_item(household, owner)
        response = _anon_client().get(reverse("shopping-item-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cross_household_items_not_visible(self, owner, household, other_owner, other_household):
        # other_household has its own item
        ShoppingListItem.objects.create(
            household=other_household, label="Secret Sauce", created_by=other_owner
        )
        # owner's list must not contain it
        self._create_item(household, owner, "Butter")
        client = _client_for(owner)
        response = client.get(reverse("shopping-item-list"))
        assert response.status_code == status.HTTP_200_OK
        labels = [item["label"] for item in response.data]
        assert "Secret Sauce" not in labels
        assert "Butter" in labels


# ── TestShoppingItemCreate ─────────────────────────────────────────────────────

@pytest.mark.django_db
class TestShoppingItemCreate:
    """POST /api/shopping/items/ — free-text create."""

    def _item_payload(self, **overrides):
        return {"label": "Coffee", "quantity": "1.5", "unit": "kg", "note": "Dark roast", **overrides}

    def test_owner_can_create_free_text_item(self, owner, household):
        client = _client_for(owner)
        payload = self._item_payload()
        response = client.post(reverse("shopping-item-list"), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["label"] == "Coffee"
        assert response.data["unit"] == "kg"
        assert response.data["note"] == "Dark roast"
        assert response.data["checked"] is False

    def test_db_state_after_create(self, owner, household):
        client = _client_for(owner)
        payload = self._item_payload(label="Tea")
        response = client.post(reverse("shopping-item-list"), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        item = ShoppingListItem.objects.get(id=response.data["id"])
        assert item.household == household
        assert item.created_by == owner
        assert item.label == "Tea"
        assert item.checked_at is None

    def test_member_can_create(self, member, household):
        client = _client_for(member)
        response = client.post(
            reverse("shopping-item-list"), {"label": "Yogurt"}, format="json"
        )
        assert response.status_code == status.HTTP_201_CREATED
        item = ShoppingListItem.objects.get(id=response.data["id"])
        assert item.household == household

    def test_anonymous_cannot_create(self, household):
        response = _anon_client().post(
            reverse("shopping-item-list"), {"label": "Milk"}, format="json"
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_missing_label_returns_400(self, owner, household):
        client = _client_for(owner)
        response = client.post(reverse("shopping-item-list"), {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "label" in response.data

    def test_blank_label_returns_400(self, owner, household):
        client = _client_for(owner)
        response = client.post(
            reverse("shopping-item-list"), {"label": "   "}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "label" in response.data

    def test_checked_is_ignored_on_create_via_rest(self, owner, household):
        """The REST perform_create routes through create_list_item which does not accept
        a 'checked' kwarg — newly created items are always unchecked. Use PATCH to
        check an item after creation.
        """
        client = _client_for(owner)
        response = client.post(
            reverse("shopping-item-list"),
            {"label": "Done Item", "checked": True},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        item = ShoppingListItem.objects.get(id=response.data["id"])
        # Items created via REST are always unchecked — use PATCH to check them.
        assert item.checked_at is None

    def test_stock_item_from_wrong_household_is_rejected(self, owner, household, other_owner, other_household):
        foreign_stock = _make_stock_item(other_household, other_owner, name="ForeignOlive")
        client = _client_for(owner)
        response = client.post(
            reverse("shopping-item-list"),
            {"label": "Olive", "stock_item": str(foreign_stock.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "stock_item" in response.data


# ── TestShoppingItemRetrieve ───────────────────────────────────────────────────

@pytest.mark.django_db
class TestShoppingItemRetrieve:
    """GET /api/shopping/items/<id>/ — retrieve by pk."""

    def _create_item(self, household, user, label="Butter"):
        return ShoppingListItem.objects.create(
            household=household, label=label, created_by=user
        )

    def test_owner_can_retrieve_own_item(self, owner, household):
        item = self._create_item(household, owner)
        client = _client_for(owner)
        response = client.get(reverse("shopping-item-detail", args=[item.id]))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["label"] == "Butter"

    def test_anonymous_gets_401(self, owner, household):
        item = self._create_item(household, owner)
        response = _anon_client().get(reverse("shopping-item-detail", args=[item.id]))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cross_household_item_returns_404(self, owner, household, other_owner, other_household):
        foreign_item = self._create_item(other_household, other_owner, "Foreign Butter")
        client = _client_for(owner)
        response = client.get(reverse("shopping-item-detail", args=[foreign_item.id]))
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ── TestShoppingItemUpdate ─────────────────────────────────────────────────────

@pytest.mark.django_db
class TestShoppingItemUpdate:
    """PUT/PATCH /api/shopping/items/<id>/ — update fields."""

    def _create_item(self, household, user, **kwargs):
        return ShoppingListItem.objects.create(
            household=household, label="Original", created_by=user, **kwargs
        )

    def _item_payload(self, **overrides):
        return {"label": "Updated", **overrides}

    def test_owner_can_patch_label(self, owner, household):
        item = self._create_item(household, owner)
        client = _client_for(owner)
        response = client.patch(
            reverse("shopping-item-detail", args=[item.id]),
            {"label": "New Label"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        item.refresh_from_db()
        assert item.label == "New Label"

    def test_member_can_patch(self, member, household, owner):
        item = self._create_item(household, owner)
        client = _client_for(member)
        response = client.patch(
            reverse("shopping-item-detail", args=[item.id]),
            {"note": "Member note"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        item.refresh_from_db()
        assert item.note == "Member note"

    def test_patch_checked_true_sets_checked_at(self, owner, household):
        item = self._create_item(household, owner)
        assert item.checked_at is None
        client = _client_for(owner)
        response = client.patch(
            reverse("shopping-item-detail", args=[item.id]),
            {"checked": True},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        item.refresh_from_db()
        assert item.checked_at is not None
        assert response.data["checked"] is True

    def test_patch_checked_false_clears_checked_at(self, owner, household):
        item = self._create_item(household, owner, checked_at=timezone.now())
        client = _client_for(owner)
        response = client.patch(
            reverse("shopping-item-detail", args=[item.id]),
            {"checked": False},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        item.refresh_from_db()
        assert item.checked_at is None
        assert response.data["checked"] is False

    def test_db_state_after_update(self, owner, household):
        item = self._create_item(household, owner)
        client = _client_for(owner)
        client.patch(
            reverse("shopping-item-detail", args=[item.id]),
            {"label": "Persisted", "quantity": "3.5", "unit": "L"},
            format="json",
        )
        item.refresh_from_db()
        assert item.label == "Persisted"
        assert item.quantity == Decimal("3.5")
        assert item.unit == "L"

    def test_anonymous_cannot_update(self, owner, household):
        item = self._create_item(household, owner)
        response = _anon_client().patch(
            reverse("shopping-item-detail", args=[item.id]),
            {"label": "Hacked"},
            format="json",
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        item.refresh_from_db()
        assert item.label == "Original"

    def test_cross_household_update_returns_404(self, owner, household, other_owner, other_household):
        foreign_item = ShoppingListItem.objects.create(
            household=other_household, label="Foreign Item", created_by=other_owner
        )
        client = _client_for(owner)
        response = client.patch(
            reverse("shopping-item-detail", args=[foreign_item.id]),
            {"label": "Hijacked"},
            format="json",
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND
        foreign_item.refresh_from_db()
        assert foreign_item.label == "Foreign Item"

    def test_blank_label_patch_returns_400(self, owner, household):
        item = self._create_item(household, owner)
        client = _client_for(owner)
        response = client.patch(
            reverse("shopping-item-detail", args=[item.id]),
            {"label": ""},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "label" in response.data


# ── TestShoppingItemDelete ─────────────────────────────────────────────────────

@pytest.mark.django_db
class TestShoppingItemDelete:
    """DELETE /api/shopping/items/<id>/ — single item deletion."""

    def _create_item(self, household, user):
        return ShoppingListItem.objects.create(
            household=household, label="To Delete", created_by=user
        )

    def test_owner_can_delete(self, owner, household):
        item = self._create_item(household, owner)
        item_id = item.id
        client = _client_for(owner)
        response = client.delete(reverse("shopping-item-detail", args=[item.id]))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not ShoppingListItem.objects.filter(id=item_id).exists()

    def test_member_can_delete(self, member, household, owner):
        item = self._create_item(household, owner)
        item_id = item.id
        client = _client_for(member)
        response = client.delete(reverse("shopping-item-detail", args=[item.id]))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not ShoppingListItem.objects.filter(id=item_id).exists()

    def test_anonymous_cannot_delete(self, owner, household):
        item = self._create_item(household, owner)
        response = _anon_client().delete(reverse("shopping-item-detail", args=[item.id]))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert ShoppingListItem.objects.filter(id=item.id).exists()

    def test_cross_household_delete_returns_404(self, owner, household, other_owner, other_household):
        foreign_item = ShoppingListItem.objects.create(
            household=other_household, label="Not Mine", created_by=other_owner
        )
        client = _client_for(owner)
        response = client.delete(reverse("shopping-item-detail", args=[foreign_item.id]))
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert ShoppingListItem.objects.filter(id=foreign_item.id).exists()


# ── TestFromStockAction ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestFromStockAction:
    """POST /api/shopping/items/from-stock/ — add a linked stock item, deduped."""

    def _from_stock_url(self):
        return reverse("shopping-item-from-stock")

    def _create_stock_item(self, household, user, name="Rice", quantity=Decimal("1"),
                           min_quantity=None, max_quantity=None):
        return _make_stock_item(household, user, name=name, quantity=quantity,
                                min_quantity=min_quantity, max_quantity=max_quantity)

    def test_adds_linked_line_and_returns_201(self, owner, household):
        stock = self._create_stock_item(household, owner)
        client = _client_for(owner)
        response = client.post(
            self._from_stock_url(),
            {"stock_item": str(stock.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["already_in_list"] is False
        assert response.data["label"] == "Rice"
        item = ShoppingListItem.objects.get(id=response.data["id"])
        assert item.stock_item == stock
        assert item.household == household

    def test_suggested_quantity_uses_max_minus_current(self, owner, household):
        # max=10, current=3 => suggested = 7
        stock = self._create_stock_item(
            household, owner, quantity=Decimal("3"), min_quantity=Decimal("2"), max_quantity=Decimal("10")
        )
        client = _client_for(owner)
        response = client.post(
            self._from_stock_url(),
            {"stock_item": str(stock.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert Decimal(response.data["quantity"]) == Decimal("7")

    def test_suggested_quantity_fallback_to_min_when_no_max(self, owner, household):
        # no max_quantity, min=5 => suggested = 5
        stock = self._create_stock_item(
            household, owner, quantity=Decimal("1"), min_quantity=Decimal("5"), max_quantity=None
        )
        client = _client_for(owner)
        response = client.post(
            self._from_stock_url(),
            {"stock_item": str(stock.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert Decimal(response.data["quantity"]) == Decimal("5")

    def test_dedup_returns_existing_line_with_200(self, owner, household):
        stock = self._create_stock_item(household, owner)
        client = _client_for(owner)
        # First call — creates the line
        r1 = client.post(self._from_stock_url(), {"stock_item": str(stock.id)}, format="json")
        assert r1.status_code == status.HTTP_201_CREATED
        first_id = r1.data["id"]
        # Second call — must return the SAME line, no duplicate created
        r2 = client.post(self._from_stock_url(), {"stock_item": str(stock.id)}, format="json")
        assert r2.status_code == status.HTTP_200_OK
        assert r2.data["already_in_list"] is True
        assert r2.data["id"] == first_id
        assert ShoppingListItem.objects.filter(stock_item=stock, checked_at__isnull=True).count() == 1

    def test_dedup_does_not_affect_checked_line(self, owner, household):
        """A checked line is treated as fulfilled — a new unchecked line must be created."""
        stock = self._create_stock_item(household, owner)
        # Pre-create a checked (fulfilled) line for this stock item
        ShoppingListItem.objects.create(
            household=household, label=stock.name, stock_item=stock,
            checked_at=timezone.now(), created_by=owner
        )
        client = _client_for(owner)
        response = client.post(
            self._from_stock_url(), {"stock_item": str(stock.id)}, format="json"
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["already_in_list"] is False
        # Now there should be 2 lines: one checked, one unchecked
        assert ShoppingListItem.objects.filter(stock_item=stock).count() == 2

    def test_missing_stock_item_returns_400(self, owner, household):
        client = _client_for(owner)
        response = client.post(self._from_stock_url(), {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "stock_item" in response.data

    def test_cross_household_stock_item_returns_400(self, owner, household, other_owner, other_household):
        foreign_stock = self._create_stock_item(other_household, other_owner, name="ForeignRice")
        client = _client_for(owner)
        response = client.post(
            self._from_stock_url(),
            {"stock_item": str(foreign_stock.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "stock_item" in response.data

    def test_anonymous_gets_401(self, owner, household):
        stock = self._create_stock_item(household, owner)
        response = _anon_client().post(
            self._from_stock_url(), {"stock_item": str(stock.id)}, format="json"
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_caller_can_override_quantity(self, owner, household):
        stock = self._create_stock_item(
            household, owner, quantity=Decimal("0"), min_quantity=Decimal("5"), max_quantity=Decimal("10")
        )
        client = _client_for(owner)
        response = client.post(
            self._from_stock_url(),
            {"stock_item": str(stock.id), "quantity": "3"},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert Decimal(response.data["quantity"]) == Decimal("3")


# ── TestBulkDeleteAction ───────────────────────────────────────────────────────

@pytest.mark.django_db
class TestBulkDeleteAction:
    """POST /api/shopping/items/bulk-delete/ — remove several lines at once."""

    def _bulk_delete_url(self):
        return reverse("shopping-item-bulk-delete")

    def _create_item(self, household, user, label="Item"):
        return ShoppingListItem.objects.create(
            household=household, label=label, created_by=user
        )

    def test_deletes_given_ids_in_household(self, owner, household):
        item1 = self._create_item(household, owner, "A")
        item2 = self._create_item(household, owner, "B")
        item3 = self._create_item(household, owner, "C")
        client = _client_for(owner)
        response = client.post(
            self._bulk_delete_url(),
            {"ids": [str(item1.id), str(item2.id)]},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["deleted"] == 2
        assert not ShoppingListItem.objects.filter(id__in=[item1.id, item2.id]).exists()
        assert ShoppingListItem.objects.filter(id=item3.id).exists()

    def test_cross_household_ids_are_ignored(self, owner, household, other_owner, other_household):
        own_item = self._create_item(household, owner, "Mine")
        foreign_item = self._create_item(other_household, other_owner, "Theirs")
        client = _client_for(owner)
        response = client.post(
            self._bulk_delete_url(),
            {"ids": [str(own_item.id), str(foreign_item.id)]},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["deleted"] == 1  # only own item deleted
        assert not ShoppingListItem.objects.filter(id=own_item.id).exists()
        assert ShoppingListItem.objects.filter(id=foreign_item.id).exists()

    def test_empty_ids_returns_zero_deleted(self, owner, household):
        self._create_item(household, owner)
        client = _client_for(owner)
        response = client.post(self._bulk_delete_url(), {"ids": []}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["deleted"] == 0

    def test_non_list_ids_returns_400(self, owner, household):
        client = _client_for(owner)
        response = client.post(self._bulk_delete_url(), {"ids": "not-a-list"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "ids" in response.data

    def test_anonymous_gets_401(self, household):
        response = _anon_client().post(self._bulk_delete_url(), {"ids": []}, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_member_can_bulk_delete(self, member, household, owner):
        item = self._create_item(household, owner, "Member Delete")
        client = _client_for(member)
        response = client.post(
            self._bulk_delete_url(),
            {"ids": [str(item.id)]},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["deleted"] == 1
        assert not ShoppingListItem.objects.filter(id=item.id).exists()
