"""
Chicken coop serializers — CRUD API + purchase/settings payloads.
"""
from django.db.models import Max
from rest_framework import serializers

from zones.models import Zone

from .models import Chicken, ChickenChore, ChickenEvent, ChickenSettings, EggLog


class ChickenSerializer(serializers.ModelSerializer):
    """Full read/write serializer for the Chicken API."""

    zone_name = serializers.SerializerMethodField()
    zone_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    # Items behind each detail tab (events/documents/photos). Filled ONLY on the
    # retrieve (detail) — null in list, to avoid paying the counts per hen. The
    # frontend hides tabs at 0. Mirrors ProjectSerializer.tab_counts.
    tab_counts = serializers.SerializerMethodField()

    class Meta:
        model = Chicken
        fields = [
            'id', 'household',
            'name', 'breed', 'color', 'hatched_on', 'acquired_on',
            'status', 'notes',
            'zone', 'zone_id', 'zone_name',
            'tab_counts',
            'created_at', 'updated_at', 'created_by',
        ]
        read_only_fields = ['id', 'household', 'zone', 'created_at', 'updated_at', 'created_by']

    def get_zone_name(self, obj):
        return obj.zone.name if obj.zone_id and obj.zone else None

    def get_tab_counts(self, obj):
        view = self.context.get('view')
        if view is not None and getattr(view, 'action', None) != 'retrieve':
            return None
        from .services import chicken_tab_counts

        return chicken_tab_counts(obj)

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


class ChickenChoreSerializer(serializers.ModelSerializer):
    """Read/write serializer for recurring coop chores.

    The derived block (``last_done_on``, ``next_due_on``, ``days_overdue``…) is
    read-only and computed by ``chickens.services.chore_status`` — the same
    function the reminder and the dashboard alert read. A second definition of
    "en retard" computed in the client is exactly the two-voices bug the money
    module already paid for.
    """

    status = serializers.SerializerMethodField()
    # Optional on the wire, mandatory in the database: the caller should not have
    # to send "today", and `create_chore` is the one place that decides what the
    # anchor is — in the household's timezone, not the server's.
    starts_on = serializers.DateField(required=False)

    class Meta:
        model = ChickenChore
        fields = [
            'id', 'household',
            'name', 'emoji', 'interval_days', 'starts_on', 'is_active', 'notes',
            'status',
            'created_at', 'updated_at', 'created_by',
        ]
        read_only_fields = ['id', 'household', 'created_at', 'updated_at', 'created_by']

    def get_status(self, obj):
        from core.timezones import household_today

        from .services import chore_status

        # `today` comes from the view, computed once for the whole page. Reading
        # `obj.household` here instead would load the household row once per
        # chore — an N+1 that only shows up on a household with several chores,
        # which is exactly the one this panel is for.
        today = self.context.get('today')
        if today is None:
            today = household_today(obj.household)
        # Annotated by chores_with_status when the caller listed them in one
        # query; falls back to a per-object lookup for a single retrieve.
        last_done_on = getattr(obj, 'last_done_on', ...)
        if last_done_on is ...:
            last_done_on = (
                obj.completions.aggregate(last=Max('occurred_on'))['last']
                if obj.pk
                else None
            )

        state = chore_status(obj, today=today, last_done_on=last_done_on)
        return {
            'last_done_on': state['last_done_on'].isoformat() if state['last_done_on'] else None,
            'next_due_on': state['next_due_on'].isoformat(),
            'days_overdue': state['days_overdue'],
            'is_due': state['is_due'],
            'never_done': state['never_done'],
        }

    def validate_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Name cannot be blank.")
        return value.strip()

    def validate_interval_days(self, value):
        if value is None or value < 1:
            raise serializers.ValidationError("Interval must be at least 1 day.")
        if value > 3650:
            raise serializers.ValidationError("Interval cannot exceed 3650 days.")
        return value


class ChickenChoreCompletionSerializer(serializers.Serializer):
    """Payload of POST /api/chickens/chores/{id}/complete/."""

    occurred_on = serializers.DateField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default='')


class ChickenPurchaseSerializer(serializers.Serializer):
    """Payload of POST /api/chickens/{id}/purchase/ — mirrors the stock purchase shape."""

    amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    supplier = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    occurred_at = serializers.DateTimeField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    # Enveloppe à laquelle imputer l'achat. Facultative, mais son absence est
    # l'écart `expense_without_budget` : sans budget, un euro n'est classé par
    # aucun axe (projet et zone disent *sur quoi* et *où*, pas *de quelle
    # nature*). L'offrir à la saisie évite de fabriquer l'écart puis de le
    # réparer.
    budget_id = serializers.UUIDField(required=False, allow_null=True)


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
