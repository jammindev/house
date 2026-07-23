"""Shopping list serializers."""
from django.utils import timezone
from rest_framework import serializers

from stock.models import StockItem

from .models import ShoppingListItem


class StockSuggestionSerializer(serializers.ModelSerializer):
    """A low-stock item proposed for the shopping list (Lot 3), read-only."""

    category_name = serializers.CharField(source="category.name", read_only=True)
    category_emoji = serializers.CharField(source="category.emoji", read_only=True)
    suggested_quantity = serializers.SerializerMethodField()

    class Meta:
        model = StockItem
        fields = [
            "id", "name", "unit", "status",
            "quantity", "min_quantity", "max_quantity",
            "category_name", "category_emoji", "suggested_quantity",
        ]

    def get_suggested_quantity(self, obj):
        from .services import suggested_quantity

        value = suggested_quantity(obj)
        return str(value) if value is not None else None


class ShoppingListItemSerializer(serializers.ModelSerializer):
    """Read/write serializer for a shopping list line.

    ``checked`` is the writable face of ``checked_at``: sending ``checked=true``
    stamps ``checked_at`` (now), ``false`` clears it. The raw ``checked_at`` is
    exposed read-only for display/sorting.
    """

    checked = serializers.BooleanField(required=False)
    stock_item = serializers.PrimaryKeyRelatedField(
        queryset=StockItem.objects.all(), required=False, allow_null=True
    )
    stock_item_name = serializers.SerializerMethodField()
    stock_item_status = serializers.SerializerMethodField()
    stock_item_emoji = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ShoppingListItem
        fields = [
            "id", "household",
            "label", "quantity", "unit", "note",
            "stock_item", "stock_item_name", "stock_item_status", "stock_item_emoji",
            "checked", "checked_at", "sort_order",
            "created_at", "updated_at", "created_by", "created_by_name",
        ]
        read_only_fields = [
            "id", "household", "checked_at", "created_at", "updated_at", "created_by",
        ]

    def get_stock_item_name(self, obj):
        return obj.stock_item.name if obj.stock_item_id and obj.stock_item else None

    def get_stock_item_status(self, obj):
        return obj.stock_item.status if obj.stock_item_id and obj.stock_item else None

    def get_stock_item_emoji(self, obj):
        item = obj.stock_item if obj.stock_item_id else None
        if item and item.category_id and item.category:
            return item.category.emoji
        return None

    def get_created_by_name(self, obj):
        return obj.created_by.full_name if obj.created_by_id and obj.created_by else None

    def validate_label(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("A label is required.")
        return value

    def validate_stock_item(self, value):
        """A linked stock item must belong to the request's household."""
        if value is None:
            return value
        household_id = self.context.get("household_id")
        if household_id and str(value.household_id) != str(household_id):
            raise serializers.ValidationError("Stock item is not in this household.")
        return value

    def _apply_checked(self, validated_data):
        """Translate the ``checked`` flag into a ``checked_at`` timestamp."""
        if "checked" in validated_data:
            checked = validated_data.pop("checked")
            validated_data["checked_at"] = timezone.now() if checked else None

    def create(self, validated_data):
        self._apply_checked(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        self._apply_checked(validated_data)
        return super().update(instance, validated_data)
