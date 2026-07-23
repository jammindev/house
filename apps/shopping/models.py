import uuid

from django.db import models
from django.utils.translation import gettext_lazy as _

from core.managers import HouseholdScopedManager
from core.models import HouseholdScopedModel


class ShoppingListItem(HouseholdScopedModel):
    """One line of the household's shared shopping list.

    A dedicated model (not ``Interaction.metadata``) because the list carries
    per-item state (checked/unchecked), an explicit order, and an optional typed
    FK to the ``StockItem`` it stands for — and those are *queried* (unchecked
    items, items linked to a given stock item), which the household journal cannot
    express. Same decision rule as ``Task`` and ``EggLog``.

    An item is either **free-text** (``stock_item`` is null — "Café", "Piles AA")
    or **linked** to an inventory item (``stock_item`` set — "Add to list" from a
    ``StockItem``). The link is optional and survives its target: deleting the
    ``StockItem`` nulls it out and the line stays as plain text.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    label = models.CharField(max_length=500)
    quantity = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    unit = models.CharField(max_length=32, default="", blank=True)
    note = models.TextField(default="", blank=True)

    stock_item = models.ForeignKey(
        "stock.StockItem",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shopping_list_items",
    )

    # None = still to buy; set = crossed off ("Pris"). We keep the row so the user
    # can un-check it and so "Clear checked" is an explicit action.
    checked_at = models.DateTimeField(null=True, blank=True)
    sort_order = models.IntegerField(default=0)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "shopping_list_items"
        verbose_name = _("shopping list item")
        verbose_name_plural = _("shopping list items")
        ordering = ["sort_order", "created_at"]
        indexes = [
            models.Index(fields=["household", "checked_at"], name="idx_shopping_hh_checked"),
            models.Index(fields=["stock_item"], name="idx_shopping_stock_item"),
        ]

    def __str__(self):
        return self.label

    @property
    def checked(self) -> bool:
        return self.checked_at is not None


class ShoppingSuggestionDismissal(HouseholdScopedModel):
    """A low-stock item the user dismissed from the "Suggestions" section (Lot 3).

    Records that a suggestion was ignored so it stops resurfacing — *until the
    item is restocked and drops low again*. Rather than clearing this on restock
    (which would couple ``stock.services`` to shopping), the suggestion query
    treats a dismissal as stale once ``StockItem.last_restocked_at`` is newer than
    ``dismissed_at``: a fresh depletion cycle re-suggests naturally.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    stock_item = models.ForeignKey(
        "stock.StockItem",
        on_delete=models.CASCADE,
        related_name="shopping_dismissals",
    )
    dismissed_at = models.DateTimeField(auto_now=True)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "shopping_suggestion_dismissals"
        verbose_name = _("shopping suggestion dismissal")
        verbose_name_plural = _("shopping suggestion dismissals")
        constraints = [
            models.UniqueConstraint(
                fields=["household", "stock_item"],
                name="uniq_shopping_dismissal_hh_item",
            ),
        ]

    def __str__(self):
        return f"dismissed {self.stock_item_id}"
