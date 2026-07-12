"""
Chicken coop serializers — CRUD API + purchase/settings payloads.
"""
from rest_framework import serializers

from zones.models import Zone

from .models import Chicken, ChickenEvent, ChickenSettings, EggLog


class ChickenSerializer(serializers.ModelSerializer):
    """Full read/write serializer for the Chicken API."""

    zone_name = serializers.SerializerMethodField()
    zone_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Chicken
        fields = [
            'id', 'household',
            'name', 'breed', 'color', 'hatched_on', 'acquired_on',
            'status', 'notes',
            'zone', 'zone_id', 'zone_name',
            'created_at', 'updated_at', 'created_by',
        ]
        read_only_fields = ['id', 'household', 'zone', 'created_at', 'updated_at', 'created_by']

    def get_zone_name(self, obj):
        return obj.zone.name if obj.zone_id and obj.zone else None

    def validate_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Name cannot be blank.")
        return value.strip()

    def validate_zone_id(self, value):
        if value is None:
            return value
        household_id = self.context.get('household_id')
        if household_id and not Zone.objects.filter(
            id=value, household_id=household_id
        ).exists():
            raise serializers.ValidationError("Zone does not belong to the household.")
        return value

    def _apply_zone(self, validated_data):
        zone_id = validated_data.pop('zone_id', ...)
        if zone_id is not ...:
            validated_data['zone_id'] = zone_id
        return validated_data

    def create(self, validated_data):
        return Chicken.objects.create(**self._apply_zone(validated_data))

    def update(self, instance, validated_data):
        for attr, value in self._apply_zone(validated_data).items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class EggLogSerializer(serializers.ModelSerializer):
    """Read/write serializer for daily egg logs. Creation is an upsert on (household, date)."""

    class Meta:
        model = EggLog
        fields = ['id', 'household', 'date', 'count', 'note', 'created_at', 'updated_at']
        read_only_fields = ['id', 'household', 'created_at', 'updated_at']


class ChickenEventSerializer(serializers.ModelSerializer):
    """Read/write serializer for flock journal entries."""

    chicken_name = serializers.SerializerMethodField()
    # Optional care reminder: when set at creation, a Task is created via
    # tasks.services.create_task (see chickens.services.create_event).
    reminder_due_date = serializers.DateField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = ChickenEvent
        fields = [
            'id', 'household',
            'chicken', 'chicken_name', 'type', 'occurred_on', 'title', 'notes',
            'reminder_due_date',
            'created_at', 'updated_at', 'created_by',
        ]
        read_only_fields = ['id', 'household', 'created_at', 'updated_at', 'created_by']

    def get_chicken_name(self, obj):
        return obj.chicken.name if obj.chicken_id and obj.chicken else None

    def validate_title(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Title cannot be blank.")
        return value.strip()

    def validate_chicken(self, value):
        if value is None:
            return value
        household_id = self.context.get('household_id')
        if household_id and str(value.household_id) != str(household_id):
            raise serializers.ValidationError("Chicken does not belong to the household.")
        return value


class ChickenPurchaseSerializer(serializers.Serializer):
    """Payload of POST /api/chickens/{id}/purchase/ — mirrors the stock purchase shape."""

    amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    supplier = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    occurred_at = serializers.DateTimeField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default='')


class ChickenSettingsSerializer(serializers.ModelSerializer):
    """Module settings — the feed stock item reference plus a read-only snapshot of it."""

    feed_stock_item_detail = serializers.SerializerMethodField()

    class Meta:
        model = ChickenSettings
        fields = ['id', 'household', 'feed_stock_item', 'feed_stock_item_detail']
        read_only_fields = ['id', 'household']

    def get_feed_stock_item_detail(self, obj):
        item = obj.feed_stock_item
        if item is None:
            return None
        return {
            'id': str(item.id),
            'name': item.name,
            'quantity': str(item.quantity),
            'unit': item.unit,
            'status': item.status,
            'min_quantity': str(item.min_quantity) if item.min_quantity is not None else None,
        }

    def validate_feed_stock_item(self, value):
        if value is None:
            return value
        household_id = self.context.get('household_id')
        if household_id and str(value.household_id) != str(household_id):
            raise serializers.ValidationError("Stock item does not belong to the household.")
        return value
