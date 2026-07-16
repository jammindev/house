"""Factory-boy factories for shopping app tests."""
from decimal import Decimal

import factory
from factory.django import DjangoModelFactory

from shopping.models import ShoppingListItem


class ShoppingListItemFactory(DjangoModelFactory):
    """Factory for ShoppingListItem — household + created_by must be set by the caller."""

    class Meta:
        model = ShoppingListItem
        skip_postgeneration_save = True

    label = factory.Faker("word")
    quantity = None
    unit = ""
    note = ""
    stock_item = None
    checked_at = None
    sort_order = 0
    # household and created_by must be supplied by each test
