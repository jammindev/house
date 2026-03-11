from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from core.permissions import resolve_request_household

from .models import StockCategory, StockItem


class StockCategoryPickerSerializer(serializers.ModelSerializer):
    """Minimal serializer for category picker dropdowns in forms."""

    class Meta:
        model = StockCategory
        fields = ["id", "name", "emoji", "color", "description", "sort_order"]


class StockCategorySerializer(serializers.ModelSerializer):
    item_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = StockCategory
        fields = [
            "id",
            "household",
            "name",
            "color",
            "emoji",
            "description",
            "sort_order",
            "item_count",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["id", "household", "created_at", "updated_at", "created_by", "updated_by", "item_count"]


class StockItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    zone_name = serializers.CharField(source="zone.name", read_only=True)
    total_value = serializers.SerializerMethodField()

    class Meta:
        model = StockItem
        fields = [
            "id",
            "household",
            "category",
            "category_name",
            "zone",
            "zone_name",
            "name",
            "description",
            "sku",
            "barcode",
            "quantity",
            "unit",
            "min_quantity",
            "max_quantity",
            "unit_price",
            "total_value",
            "purchase_date",
            "expiration_date",
            "last_restocked_at",
            "status",
            "supplier",
            "notes",
            "tags",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["id", "household", "created_at", "updated_at", "created_by", "updated_by", "total_value"]

    def get_total_value(self, obj):
        if obj.unit_price is None:
            return None
        return Decimal(obj.quantity) * obj.unit_price

    def validate_category(self, value):
        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            return value

        if not value.household.householdmember_set.filter(user=request.user).exists():
            raise serializers.ValidationError(_("Invalid category or access denied."))

        return value

    def validate_zone(self, value):
        if value is None:
            return value

        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            return value

        if not value.household.householdmember_set.filter(user=request.user).exists():
            raise serializers.ValidationError(_("Invalid zone or access denied."))

        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)

        category = attrs.get("category")
        zone = attrs.get("zone")
        request = self.context.get("request")
        household = getattr(self.instance, "household", None) or attrs.get("household")
        if household is None and request:
            household = resolve_request_household(request, required=False)

        if category and household and category.household_id != household.id:
            raise serializers.ValidationError({"category": _("Category must belong to the same household as item.")})

        if zone and household and zone.household_id != household.id:
            raise serializers.ValidationError({"zone": _("Zone must belong to the same household as item.")})

        min_quantity = attrs.get("min_quantity")
        max_quantity = attrs.get("max_quantity")
        if min_quantity is not None and max_quantity is not None and min_quantity > max_quantity:
            raise serializers.ValidationError({"max_quantity": _("Max quantity must be greater than or equal to min quantity.")})

        return attrs


class StockQuantityAdjustSerializer(serializers.Serializer):
    delta = serializers.DecimalField(max_digits=12, decimal_places=3)

    def validate_delta(self, value):
        if value == 0:
            raise serializers.ValidationError(_("Delta must not be zero."))
        return value


class StockCategorySummarySerializer(serializers.Serializer):
    category_id = serializers.UUIDField()
    category_name = serializers.CharField()
    color = serializers.CharField()
    emoji = serializers.CharField()
    item_count = serializers.IntegerField()
    total_quantity = serializers.DecimalField(max_digits=16, decimal_places=3)
    total_value = serializers.DecimalField(max_digits=16, decimal_places=2)
    low_stock_count = serializers.IntegerField()
    out_of_stock_count = serializers.IntegerField()
    expiring_soon_count = serializers.IntegerField()


def build_category_summary(category_queryset):
    now = timezone.now().date()
    upcoming = now + timedelta(days=7)

    summary = []
    for category in category_queryset:
        items = list(category.items.all())
        item_count = len(items)
        total_quantity = sum((item.quantity for item in items), Decimal("0"))
        total_value = sum(
            ((item.unit_price or Decimal("0")) * item.quantity for item in items),
            Decimal("0"),
        )
        low_stock_count = len([item for item in items if item.min_quantity is not None and item.quantity <= item.min_quantity])
        out_of_stock_count = len([item for item in items if item.quantity <= 0])
        expiring_soon_count = len(
            [
                item
                for item in items
                if item.expiration_date is not None and now <= item.expiration_date <= upcoming
            ]
        )

        summary.append(
            {
                "category_id": category.id,
                "category_name": category.name,
                "color": category.color,
                "emoji": category.emoji,
                "item_count": item_count,
                "total_quantity": total_quantity,
                "total_value": total_value,
                "low_stock_count": low_stock_count,
                "out_of_stock_count": out_of_stock_count,
                "expiring_soon_count": expiring_soon_count,
            }
        )

    return summary
