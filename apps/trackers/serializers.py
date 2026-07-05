"""
Tracker serializers — CRUD API.

The generic target is (de)serialized through the agent searchables registry:
``target_type`` is an agent entity_type string ('equipment', 'zone',
'stock_item'…), resolved lazily (the registry is only populated after
``ready()``). Anything searchable by the agent is linkable to a tracker.
"""
from django.utils import timezone
from rest_framework import serializers

from .models import Tracker, TrackerEntry


def _find_searchable_spec(entity_type: str):
    """Lazy registry lookup — never resolve specs at module import time."""
    from agent.searchables import find_spec

    return find_spec(entity_type)


def _spec_for_instance(instance):
    from agent.searchables import find_spec_for_instance

    return find_spec_for_instance(instance)


def _searchable_label(spec, instance) -> str:
    from agent.searchables import resolve_label

    return resolve_label(spec, instance)


class TrackerEntrySerializer(serializers.ModelSerializer):
    """Read/write serializer for tracker entries."""

    tracker = serializers.PrimaryKeyRelatedField(queryset=Tracker.objects.all())
    # Optional on input — validate() defaults it to now (quick-add from the card).
    occurred_at = serializers.DateTimeField(required=False)

    class Meta:
        model = TrackerEntry
        fields = [
            'id', 'tracker', 'value', 'occurred_at', 'note',
            'created_at', 'created_by',
        ]
        read_only_fields = ['id', 'created_at', 'created_by']

    def validate_tracker(self, tracker):
        household_id = self.context.get('household_id')
        if household_id and str(tracker.household_id) != str(household_id):
            raise serializers.ValidationError('Invalid tracker or access denied.')
        return tracker

    def validate(self, attrs):
        if not self.instance and not attrs.get('occurred_at'):
            attrs['occurred_at'] = timezone.now()
        return attrs


class TrackerSerializer(serializers.ModelSerializer):
    """Full read/write serializer for the Tracker API."""

    # Generic target — written as (entity_type, id), read back with label + URL.
    # Declared write-only (not model fields); to_representation re-adds them.
    target_type = serializers.CharField(
        required=False, allow_null=True, allow_blank=True, write_only=True
    )
    target_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)
    target_label = serializers.SerializerMethodField()
    target_url = serializers.SerializerMethodField()

    project_title = serializers.SerializerMethodField()
    sparkline = serializers.SerializerMethodField()

    class Meta:
        model = Tracker
        fields = [
            'id', 'household',
            'name', 'description', 'unit', 'emoji', 'is_active',
            'project', 'project_title',
            'target_type', 'target_id', 'target_label', 'target_url',
            'last_value', 'last_entry_at', 'sparkline',
            'created_at', 'updated_at', 'created_by',
        ]
        read_only_fields = [
            'id', 'household', 'last_value', 'last_entry_at',
            'created_at', 'updated_at', 'created_by',
        ]

    # ── Read side ─────────────────────────────────────────────────────────

    def to_representation(self, instance):
        data = super().to_representation(instance)
        spec = self._target_spec(instance)
        data['target_type'] = spec.entity_type if spec else None
        data['target_id'] = (
            str(instance.target_object_id) if instance.target_object_id else None
        )
        return data

    def _target_spec(self, obj):
        if not obj.target_content_type_id:
            return None
        model = obj.target_content_type.model_class()
        if model is None:
            return None
        from agent.searchables import REGISTRY

        for spec in REGISTRY:
            if spec.model is model:
                return spec
        return None

    def get_target_label(self, obj):
        spec = self._target_spec(obj)
        if spec is None or obj.target is None:
            return None
        return _searchable_label(spec, obj.target)

    def get_target_url(self, obj):
        spec = self._target_spec(obj)
        if spec is None or obj.target_object_id is None:
            return None
        return spec.url_template.format(id=obj.target_object_id)

    def get_project_title(self, obj):
        return obj.project.title if obj.project_id and obj.project else None

    def get_sparkline(self, obj):
        # Chronological last N entries, served by the sliced prefetch set by the
        # viewset (one query for the whole list). Falls back to a direct query
        # for detail/serializer-only paths.
        entries = getattr(obj, 'sparkline_entries', None)
        if entries is None:
            entries = list(
                obj.entries.order_by('-occurred_at', '-created_at')[:30]
            )
        return [
            {'value': str(e.value), 'occurred_at': e.occurred_at.isoformat()}
            for e in reversed(entries)
        ]

    # ── Write side ────────────────────────────────────────────────────────

    def validate_project(self, project):
        household_id = self.context.get('household_id')
        if (
            project is not None
            and household_id
            and str(project.household_id) != str(household_id)
        ):
            raise serializers.ValidationError('Invalid project or access denied.')
        return project

    def validate(self, attrs):
        target_type = attrs.pop('target_type', serializers.empty)
        target_id = attrs.pop('target_id', serializers.empty)

        provided = target_type is not serializers.empty or target_id is not serializers.empty
        if not provided:
            return attrs

        # Normalize blanks to None so "clear the target" works with nulls.
        target_type = None if target_type in (serializers.empty, None, '') else target_type
        target_id = None if target_id in (serializers.empty, None) else target_id

        if (target_type is None) != (target_id is None):
            raise serializers.ValidationError(
                {'target_type': 'target_type and target_id must be provided together.'}
            )

        if target_type is None:
            attrs['target_content_type'] = None
            attrs['target_object_id'] = None
            return attrs

        spec = _find_searchable_spec(target_type)
        if spec is None:
            raise serializers.ValidationError(
                {'target_type': f'Unknown entity type: {target_type}.'}
            )

        household_id = self.context.get('household_id')
        qs = spec.model.objects.filter(pk=target_id)
        if household_id:
            qs = qs.filter(household_id=household_id)
        instance = qs.first()
        if instance is None:
            raise serializers.ValidationError(
                {'target_id': 'Target entity not found in this household.'}
            )

        from django.contrib.contenttypes.models import ContentType

        attrs['target_content_type'] = ContentType.objects.get_for_model(spec.model)
        attrs['target_object_id'] = instance.pk
        return attrs
