"""
Interaction serializers for REST API.
"""
from rest_framework import serializers
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
    zone_names = serializers.SerializerMethodField()
    document_count = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    tags_input = serializers.ListField(
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
            'project',
            'zone_ids', 'zone_names', 'document_count',
            'created_at', 'updated_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['id', 'household', 'created_at', 'updated_at', 'created_by']
    
    def get_zone_names(self, obj):
        return [zone.name for zone in obj.zones.all()]
    
    def get_document_count(self, obj):
        return obj.documents.count()
    
    def get_tags(self, obj):
        return [link.tag.name for link in obj.tags.all()]

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
            TagLink.objects.get_or_create(
                household=interaction.household,
                tag=tag,
                content_object=interaction,
                defaults={'created_by': interaction.created_by},
            )
    
    def create(self, validated_data):
        tag_names = validated_data.pop('tags_input', [])
        zone_ids = validated_data.pop('zone_ids', [])
        interaction = Interaction.objects.create(**validated_data)
        
        # Link zones
        from zones.models import Zone
        for zone_id in zone_ids:
            zone = Zone.objects.get(id=zone_id, household=interaction.household)
            InteractionZone.objects.create(interaction=interaction, zone=zone)

        self._sync_tags(interaction, tag_names)
        
        return interaction
    
    def update(self, instance, validated_data):
        tag_names = validated_data.pop('tags_input', None)
        zone_ids = validated_data.pop('zone_ids', None)
        
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
        return [
            {
                'id': str(doc.id),
                'name': doc.name,
                'type': doc.type,
                'file_path': doc.file_path
            }
            for doc in obj.documents.all()
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
    class Meta:
        model = InteractionDocument
        fields = ['interaction', 'document', 'role', 'note', 'created_at']
        read_only_fields = ['created_at']