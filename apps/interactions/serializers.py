"""
Interaction serializers for REST API.
"""
from django.db import transaction
from django.contrib.contenttypes.models import ContentType
from rest_framework import serializers
from documents.models import Document
from tags.models import Tag, TagLink
from .models import (
    Interaction,
    InteractionZone,
    InteractionContact,
    InteractionStructure,
    InteractionDocument,
)


class InteractionSerializer(serializers.ModelSerializer):
    """Interaction list/create serializer."""
    
    created_by_name = serializers.CharField(
        source='created_by.full_name',
        read_only=True
    )
    zone_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=True
    )
    project_title = serializers.SerializerMethodField()
    stock_item_name = serializers.CharField(source='stock_item.name', read_only=True)
    zone_names = serializers.SerializerMethodField()
    document_count = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    linked_document_ids = serializers.SerializerMethodField()
    tags_input = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=False,
        allow_empty=True,
    )
    document_ids = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=False,
        allow_empty=True,
    )
    
    class Meta:
        model = Interaction
        fields = [
            'id', 'household', 'subject', 'content', 'type', 'status',
            'is_private', 'occurred_at', 'tags', 'tags_input', 'metadata', 'enriched_text',
            'project', 'project_title',
            'stock_item', 'stock_item_name',
            'zone_ids', 'zone_names', 'document_count', 'linked_document_ids', 'document_ids',
            'created_at', 'updated_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['id', 'household', 'created_at', 'updated_at', 'created_by']

    def validate(self, data):
        data = super().validate(data)
        interaction_type = data.get('type') or (self.instance.type if self.instance else None)
        if interaction_type != 'todo' and not data.get('occurred_at') and not (self.instance and self.instance.occurred_at):
            raise serializers.ValidationError({'occurred_at': 'This field is required for this interaction type.'})
        return data
    
    def get_project_title(self, obj):
        if obj.project_id:
            return obj.project.title if obj.project else None
        return None

    def get_zone_names(self, obj):
        return [zone.name for zone in obj.zones.all()]

    def _get_linked_document_ids(self, obj):
        document_ids = {str(document_id) for document_id in obj.interaction_documents.values_list('document_id', flat=True)}
        document_ids.update(str(document_id) for document_id in obj.documents.values_list('id', flat=True))
        return sorted(document_ids)
    
    def get_document_count(self, obj):
        return len(self._get_linked_document_ids(obj))
    
    def get_tags(self, obj):
        return [link.tag.name for link in obj.tags.all()]

    def get_linked_document_ids(self, obj):
        return self._get_linked_document_ids(obj)

    def _sync_tags(self, interaction, tag_names):
        if tag_names is None:
            return

        normalized_names = []
        for name in tag_names:
            clean_name = (name or '').strip()
            if clean_name and clean_name not in normalized_names:
                normalized_names.append(clean_name)

        existing_links = interaction.tags.select_related('tag')
        existing_by_name = {link.tag.name: link for link in existing_links}

        for link_name, link in existing_by_name.items():
            if link_name not in normalized_names:
                link.delete()

        for tag_name in normalized_names:
            if tag_name in existing_by_name:
                continue

            tag, _ = Tag.objects.get_or_create(
                household=interaction.household,
                type=Tag.TagType.INTERACTION,
                name=tag_name,
                defaults={'created_by': interaction.created_by},
            )
            interaction_content_type = ContentType.objects.get_for_model(interaction, for_concrete_model=False)
            TagLink.objects.get_or_create(
                household=interaction.household,
                tag=tag,
                content_type=interaction_content_type,
                object_id=str(interaction.id),
                defaults={'created_by': interaction.created_by},
            )
    
    def create(self, validated_data):
        tag_names = validated_data.pop('tags_input', [])
        zone_ids = validated_data.pop('zone_ids', [])
        document_ids = validated_data.pop('document_ids', [])

        with transaction.atomic():
            interaction = Interaction.objects.create(**validated_data)

            from zones.models import Zone
            for zone_id in zone_ids:
                zone = Zone.objects.get(id=zone_id, household=interaction.household)
                InteractionZone.objects.create(interaction=interaction, zone=zone)

            for document_id in document_ids:
                document = Document.objects.get(id=document_id, household=interaction.household)
                InteractionDocument.objects.create(interaction=interaction, document=document)

            self._sync_tags(interaction, tag_names)

        return interaction
    
    def update(self, instance, validated_data):
        tag_names = validated_data.pop('tags_input', None)
        zone_ids = validated_data.pop('zone_ids', None)
        validated_data.pop('document_ids', None)
        
        # Update interaction fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update zones if provided
        if zone_ids is not None:
            from zones.models import Zone
            instance.zones.clear()
            for zone_id in zone_ids:
                zone = Zone.objects.get(id=zone_id, household=instance.household)
                InteractionZone.objects.create(interaction=instance, zone=zone)

        self._sync_tags(instance, tag_names)
        
        return instance


class InteractionDetailSerializer(InteractionSerializer):
    """Interaction detail with full related data."""
    
    zones_detail = serializers.SerializerMethodField()
    documents = serializers.SerializerMethodField()
    
    class Meta(InteractionSerializer.Meta):
        fields = InteractionSerializer.Meta.fields + ['zones_detail', 'documents']
    
    def get_zones_detail(self, obj):
        return [
            {'id': str(zone.id), 'name': zone.name, 'color': zone.color}
            for zone in obj.zones.all()
        ]
    
    def get_documents(self, obj):
        legacy_documents = list(obj.documents.all())
        linked_documents = [link.document for link in obj.interaction_documents.select_related('document').all() if link.document]
        unique_documents = {document.id: document for document in [*legacy_documents, *linked_documents]}.values()
        return [
            {
                'id': str(doc.id),
                'name': doc.name,
                'type': doc.type,
                'file_path': doc.file_path
            }
            for doc in unique_documents
        ]


class InteractionContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = InteractionContact
        fields = ['interaction', 'contact', 'created_at']
        read_only_fields = ['created_at']


class InteractionStructureSerializer(serializers.ModelSerializer):
    class Meta:
        model = InteractionStructure
        fields = ['interaction', 'structure', 'created_at']
        read_only_fields = ['created_at']


class InteractionDocumentSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        request = self.context.get('request')
        interaction = attrs.get('interaction')
        document = attrs.get('document')

        if request is None or interaction is None or document is None:
            return attrs

        if not Interaction.objects.for_user_households(request.user).filter(id=interaction.id).exists():
            raise serializers.ValidationError({'interaction': 'Invalid interaction or access denied.'})

        if not Document.objects.filter(
            household_id__in=request.user.householdmember_set.values_list('household_id', flat=True),
            id=document.id,
        ).exists():
            raise serializers.ValidationError({'document': 'Invalid document or access denied.'})

        if interaction.household_id != document.household_id:
            raise serializers.ValidationError({'document': 'Document must belong to the same household as the interaction.'})

        selected_household = request.household
        if selected_household and (
            interaction.household_id != selected_household.id or document.household_id != selected_household.id
        ):
            raise serializers.ValidationError({'household_id': 'Selected household does not match interaction or document.'})

        return attrs

    class Meta:
        model = InteractionDocument
        fields = ['interaction', 'document', 'role', 'note', 'created_at']
        read_only_fields = ['created_at']
        validators = []