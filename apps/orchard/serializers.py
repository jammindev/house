"""
Orchard serializers — CRUD payloads for subjects, journal entries and harvests.
"""
from rest_framework import serializers

from core.timezones import household_today
from zones.models import Zone

from .models import Harvest, Tree, TreeEvent


class TreeSerializer(serializers.ModelSerializer):
    """Full read/write serializer for the Tree API.

    ``zone_id`` is a plain UUID validated against the household rather than a
    ``PrimaryKeyRelatedField``: a relation field's default queryset spans every
    household, and write-side isolation is exactly the hole issue #498 tracks.
    """

    zone_id = serializers.UUIDField(write_only=True, required=False, allow_null=False)
    zone_name = serializers.SerializerMethodField()
    # Derived from planted_on, never stored — an age that is written down is wrong
    # the following year.
    age_years = serializers.SerializerMethodField()
    # Items behind each detail tab. Filled ONLY on retrieve (null in list) so the
    # grid does not pay the counts per subject. Mirrors ChickenSerializer.
    tab_counts = serializers.SerializerMethodField()

    class Meta:
        model = Tree
        fields = [
            'id', 'household',
            'name', 'kind', 'species', 'rootstock', 'planted_on',
            'flowering_start_month', 'flowering_end_month',
            'status', 'notes',
            'zone', 'zone_id', 'zone_name',
            'age_years', 'tab_counts',
            'created_at', 'updated_at', 'created_by',
        ]
        read_only_fields = ['id', 'household', 'zone', 'created_at', 'updated_at', 'created_by']

    def get_zone_name(self, obj):
        return obj.zone.name if obj.zone_id and obj.zone else None

    def get_age_years(self, obj):
        if not obj.planted_on:
            return None
        today = household_today(obj.household)
        years = today.year - obj.planted_on.year
        if (today.month, today.day) < (obj.planted_on.month, obj.planted_on.day):
            years -= 1
        return max(years, 0)

    def get_tab_counts(self, obj):
        view = self.context.get('view')
        if view is not None and getattr(view, 'action', None) != 'retrieve':
            return None
        from .services import tree_tab_counts

        return tree_tab_counts(obj)

    def validate_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Name cannot be blank.")
        return value.strip()

    def validate_zone_id(self, value):
        household_id = self.context.get('household_id')
        if household_id and not Zone.objects.filter(
            id=value, household_id=household_id
        ).exists():
            raise serializers.ValidationError("Zone does not belong to the household.")
        return value

    def validate(self, attrs):
        # The zone is required at creation — a subject with no place is a subject
        # nobody finds again.
        if self.instance is None and not attrs.get('zone_id'):
            raise serializers.ValidationError({'zone_id': "A zone is required."})

        start = attrs.get(
            'flowering_start_month',
            self.instance.flowering_start_month if self.instance else None,
        )
        end = attrs.get(
            'flowering_end_month',
            self.instance.flowering_end_month if self.instance else None,
        )
        if (start is None) != (end is None):
            raise serializers.ValidationError(
                "Both flowering months must be provided, or neither."
            )
        for bound in (start, end):
            if bound is not None and not 1 <= bound <= 12:
                raise serializers.ValidationError("Flowering months must be between 1 and 12.")
        return attrs

    def _apply_zone(self, validated_data):
        zone_id = validated_data.pop('zone_id', ...)
        if zone_id is not ...:
            validated_data['zone_id'] = zone_id
        return validated_data

    def create(self, validated_data):
        return Tree.objects.create(**self._apply_zone(validated_data))

    def update(self, instance, validated_data):
        for attr, value in self._apply_zone(validated_data).items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class _TreeScopedSerializer(serializers.ModelSerializer):
    """Shared household check for the two models hanging off a Tree."""

    def validate_tree(self, value):
        household_id = self.context.get('household_id')
        if household_id and value.household_id != household_id:
            raise serializers.ValidationError("Tree does not belong to the household.")
        return value


class TreeEventSerializer(_TreeScopedSerializer):
    """Read/write serializer for care journal entries."""

    tree_name = serializers.SerializerMethodField()
    # Optional on the wire, mandatory in the column: the default is « today **in
    # the household's timezone** », which only `services.create_event` can know.
    # Requiring it here would 400 before the service ever runs.
    occurred_on = serializers.DateField(required=False)

    class Meta:
        model = TreeEvent
        fields = [
            'id', 'household',
            'tree', 'tree_name', 'type', 'occurred_on', 'title', 'notes',
            'created_at', 'updated_at', 'created_by',
        ]
        read_only_fields = ['id', 'household', 'created_at', 'updated_at', 'created_by']

    def get_tree_name(self, obj):
        return obj.tree.name if obj.tree_id else None

    def validate_title(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Title cannot be blank.")
        return value.strip()


class HarvestSerializer(_TreeScopedSerializer):
    """Read/write serializer for harvests."""

    tree_name = serializers.SerializerMethodField()
    # The season a harvest belongs to — the calendar year of the picking day.
    season = serializers.SerializerMethodField()
    # Same reason as TreeEvent.occurred_on: the default is the household's today.
    harvested_on = serializers.DateField(required=False)

    class Meta:
        model = Harvest
        fields = [
            'id', 'household',
            'tree', 'tree_name', 'harvested_on', 'quantity', 'unit', 'notes', 'season',
            'created_at', 'updated_at', 'created_by',
        ]
        read_only_fields = ['id', 'household', 'created_at', 'updated_at', 'created_by']

    def get_tree_name(self, obj):
        return obj.tree.name if obj.tree_id else None

    def get_season(self, obj):
        return obj.harvested_on.year if obj.harvested_on else None

    def validate_quantity(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("Quantity must be greater than zero.")
        return value
