"""
Task serializers — CRUD API.
"""
from django.db import transaction
from rest_framework import serializers
from households.models import HouseholdMember
from .models import Task, TaskZone, TaskDocument, TaskInteraction


class TaskDocumentSummarySerializer(serializers.ModelSerializer):
    """Minimal document info embedded in Task responses."""

    document_id = serializers.CharField(source='document.id', read_only=True)
    name = serializers.CharField(source='document.name', read_only=True)
    type = serializers.CharField(source='document.type', read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = TaskDocument
        fields = ['id', 'document_id', 'name', 'type', 'file_url', 'note']

    def get_file_url(self, obj):
        if not obj.document.file_path:
            return None
        request = self.context.get('request')
        url = f"/media/{obj.document.file_path}"
        if request:
            return request.build_absolute_uri(url)
        return url


class TaskInteractionSummarySerializer(serializers.ModelSerializer):
    """Minimal interaction info embedded in Task responses."""

    interaction_id = serializers.CharField(source='interaction.id', read_only=True)
    subject = serializers.CharField(source='interaction.subject', read_only=True)
    type = serializers.CharField(source='interaction.type', read_only=True)
    occurred_at = serializers.DateTimeField(source='interaction.occurred_at', read_only=True, allow_null=True)

    class Meta:
        model = TaskInteraction
        fields = ['id', 'interaction_id', 'subject', 'type', 'occurred_at', 'note']


class TaskDocumentLinkSerializer(serializers.ModelSerializer):
    """Read/write serializer for TaskDocument links."""

    class Meta:
        model = TaskDocument
        fields = ['id', 'task', 'document', 'note', 'created_at', 'created_by']
        read_only_fields = ['id', 'created_at', 'created_by']
        # Suppress auto-added UniqueTogetherValidator — 409 is handled in the view
        validators = []


class TaskInteractionLinkSerializer(serializers.ModelSerializer):
    """Read/write serializer for TaskInteraction links."""

    class Meta:
        model = TaskInteraction
        fields = ['id', 'task', 'interaction', 'note', 'created_at', 'created_by']
        read_only_fields = ['id', 'created_at', 'created_by']
        # Suppress auto-added UniqueTogetherValidator — 409 is handled in the view
        validators = []


class TaskSerializer(serializers.ModelSerializer):
    """Full read/write serializer for the Task API."""

    # Read-only computed fields
    project_title = serializers.SerializerMethodField()
    zone_names = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()
    completed_by_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    linked_documents = serializers.SerializerMethodField()
    linked_interactions = serializers.SerializerMethodField()
    linked_document_count = serializers.SerializerMethodField()
    linked_interaction_count = serializers.SerializerMethodField()

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
    # Document PKs are integers; interaction PKs are UUIDs
    document_ids = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=False,
    )
    interaction_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False,
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
            'linked_documents', 'linked_interactions',
            'linked_document_count', 'linked_interaction_count',
            'document_ids', 'interaction_ids',
            'created_at', 'updated_at', 'created_by', 'created_by_name',
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

    def get_created_by_name(self, obj):
        return obj.created_by.full_name if obj.created_by_id and obj.created_by else None

    def get_linked_documents(self, obj):
        links = list(obj.task_documents.all())
        return TaskDocumentSummarySerializer(
            links, many=True, context=self.context
        ).data

    def get_linked_interactions(self, obj):
        links = list(obj.task_interactions.all())
        return TaskInteractionSummarySerializer(
            links, many=True, context=self.context
        ).data

    def get_linked_document_count(self, obj):
        return len(obj.task_documents.all())

    def get_linked_interaction_count(self, obj):
        return len(obj.task_interactions.all())

    def validate(self, data):
        # Résoudre is_private : valeur du payload ou celle de l'instance en cours d'update
        is_private = data.get('is_private')
        if is_private is None and self.instance is not None:
            is_private = self.instance.is_private

        # Résoudre assigned_to_id : sentinel (...) absent du dict si non fourni
        assigned_to_id = data.get('assigned_to_id', ...)
        if assigned_to_id is ...:
            # PATCH sans assigned_to_id : on regarde l'instance existante
            if self.instance is not None:
                assigned_to_id = self.instance.assigned_to_id
            else:
                assigned_to_id = None

        if is_private and assigned_to_id is not None:
            raise serializers.ValidationError(
                {'assigned_to_id': "Une tâche privée ne peut pas être assignée à quelqu'un."}
            )
        return data

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
        document_ids = validated_data.pop('document_ids', [])
        interaction_ids = validated_data.pop('interaction_ids', [])
        if assigned_to_id is not None:
            validated_data['assigned_to_id'] = assigned_to_id

        with transaction.atomic():
            task = Task.objects.create(**validated_data)
            from zones.models import Zone
            for zone_id in zone_ids:
                zone = Zone.objects.get(id=zone_id, household=task.household)
                TaskZone.objects.create(task=task, zone=zone)
            from documents.models import Document
            for doc_id in document_ids:
                doc = Document.objects.get(id=doc_id, household=task.household)
                TaskDocument.objects.get_or_create(task=task, document=doc)
            from interactions.models import Interaction
            for int_id in interaction_ids:
                interaction = Interaction.objects.get(id=int_id, household=task.household)
                TaskInteraction.objects.get_or_create(task=task, interaction=interaction)

        return task

    def update(self, instance, validated_data):
        zone_ids = validated_data.pop('zone_ids', None)
        assigned_to_id = validated_data.pop('assigned_to_id', ...)  # sentinel
        validated_data.pop('document_ids', None)
        validated_data.pop('interaction_ids', None)

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
