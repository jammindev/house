"""
Tracker serializers — CRUD API.
"""
from django.utils import timezone
from rest_framework import serializers

from .models import Tracker, TrackerEntry


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

    project_title = serializers.SerializerMethodField()
    sparkline = serializers.SerializerMethodField()

    class Meta:
        model = Tracker
        fields = [
            'id', 'household',
            'name', 'description', 'unit', 'emoji', 'is_active',
            'project', 'project_title',
            'last_value', 'last_entry_at', 'sparkline',
            'created_at', 'updated_at', 'created_by',
        ]
        read_only_fields = [
            'id', 'household', 'last_value', 'last_entry_at',
            'created_at', 'updated_at', 'created_by',
        ]

    def get_project_title(self, obj):
        return obj.project.title if obj.project_id and obj.project else None

    def get_sparkline(self, obj):
        # Served by the sliced prefetch set by the viewset (one query for the
        # whole list). Falls back to a direct query for detail paths.
        entries = getattr(obj, 'sparkline_entries', None)
        if entries is None:
            entries = list(
                obj.entries.order_by('-occurred_at', '-created_at')[:120]
            )
        return [
            {'value': str(e.value), 'occurred_at': e.occurred_at.isoformat()}
            for e in reversed(entries[:30])
        ]

    def validate_project(self, project):
        household_id = self.context.get('household_id')
        if (
            project is not None
            and household_id
            and str(project.household_id) != str(household_id)
        ):
            raise serializers.ValidationError('Invalid project or access denied.')
        return project
