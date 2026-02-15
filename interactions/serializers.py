"""
Interaction serializers for REST API.
"""
from rest_framework import serializers
from .models import Interaction, InteractionZone, InteractionContact, InteractionStructure


class InteractionSerializer(serializers.ModelSerializer):
    """Interaction list/create serializer."""
    
    created_by_name = serializers.CharField(
        source='created_by.get_full_name',
        read_only=True
    )
    zone_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=True
    )
    zone_names = serializers.SerializerMethodField()
    document_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Interaction
        fields = [
            'id', 'household', 'subject', 'content', 'type', 'status',
            'occurred_at', 'tags', 'metadata', 'enriched_text',
            # 'project',  # TODO: Uncomment after projects app
            'zone_ids', 'zone_names', 'document_count',
            'created_at', 'updated_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['id', 'household', 'created_at', 'updated_at', 'created_by']
    
    def get_zone_names(self, obj):
        return [zone.name for zone in obj.zones.all()]
    
    def get_document_count(self, obj):
        return obj.documents.count()
    
    def create(self, validated_data):
        zone_ids = validated_data.pop('zone_ids', [])
        interaction = Interaction.objects.create(**validated_data)
        
        # Link zones
        from zones.models import Zone
        for zone_id in zone_ids:
            zone = Zone.objects.get(id=zone_id, household=interaction.household)
            InteractionZone.objects.create(interaction=interaction, zone=zone)
        
        return interaction
    
    def update(self, instance, validated_data):
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