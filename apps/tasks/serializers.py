"""
Task serializers — CRUD API.
"""
from django.db import transaction
from rest_framework import serializers
from households.models import HouseholdMember
from .models import Task, TaskZone


class TaskSerializer(serializers.ModelSerializer):
    """Full read/write serializer for the Task API."""

    # Read-only computed fields
    project_title = serializers.SerializerMethodField()
    zone_names = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()
    completed_by_name = serializers.SerializerMethodField()

    # Write-only inputs
    zone_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=True,
    )
    assigned_to_id = serializers.IntegerField(
        write_only=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Task
        fields = [
            'id', 'household',
            'subject', 'content', 'status', 'priority', 'due_date', 'is_private',
            'assigned_to', 'assigned_to_id', 'assigned_to_name',
            'completed_by', 'completed_by_name', 'completed_at',
            'project', 'project_title',
            'zone_ids', 'zone_names',
            'source_interaction',
            'created_at', 'updated_at', 'created_by',
        ]
        read_only_fields = [
            'id', 'household', 'assigned_to', 'completed_by', 'completed_at',
            'created_at', 'updated_at', 'created_by',
        ]

    def get_project_title(self, obj):
        return obj.project.title if obj.project_id and obj.project else None

    def get_zone_names(self, obj):
        return [zone.name for zone in obj.zones.all()]

    def get_assigned_to_name(self, obj):
        return obj.assigned_to.full_name if obj.assigned_to_id and obj.assigned_to else None

    def get_completed_by_name(self, obj):
        return obj.completed_by.full_name if obj.completed_by_id and obj.completed_by else None

    def validate_assigned_to_id(self, value):
        if value is None:
            return value
        request = self.context.get('request')
        if not request:
            return value
        # Resolve household from context (set by the viewset before calling serializer)
        household_id = self.context.get('household_id')
        if household_id and not HouseholdMember.objects.filter(
            household_id=household_id,
            user_id=value,
        ).exists():
            raise serializers.ValidationError(
                "This user is not a member of the household."
            )
        return value

    def create(self, validated_data):
        zone_ids = validated_data.pop('zone_ids', [])
        assigned_to_id = validated_data.pop('assigned_to_id', None)
        if assigned_to_id is not None:
            validated_data['assigned_to_id'] = assigned_to_id

        with transaction.atomic():
            task = Task.objects.create(**validated_data)
            from zones.models import Zone
            for zone_id in zone_ids:
                zone = Zone.objects.get(id=zone_id, household=task.household)
                TaskZone.objects.create(task=task, zone=zone)

        return task

    def update(self, instance, validated_data):
        zone_ids = validated_data.pop('zone_ids', None)
        assigned_to_id = validated_data.pop('assigned_to_id', ...)  # sentinel

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if assigned_to_id is not ...:
            instance.assigned_to_id = assigned_to_id

        instance.save()

        if zone_ids is not None:
            from zones.models import Zone
            instance.zones.clear()
            for zone_id in zone_ids:
                zone = Zone.objects.get(id=zone_id, household=instance.household)
                TaskZone.objects.create(task=instance, zone=zone)

        return instance
