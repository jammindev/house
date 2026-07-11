"""
Interaction serializers for REST API.
"""
from decimal import Decimal

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


# Source models a client may link an interaction to via the generic write API.
# Stock/equipment purchases go through their own endpoints, but the read shape
# is shared so the write allowlist mirrors it.
ALLOWED_SOURCE_TYPES = {'projects.project', 'stock.stockitem', 'equipment.equipment'}


class SourceContentTypeField(serializers.Field):
    """Read/write the polymorphic source type as an 'app_label.model' string."""

    def to_representation(self, value):
        return f"{value.app_label}.{value.model}"

    def to_internal_value(self, data):
        key = str(data).strip().lower()
        if key not in ALLOWED_SOURCE_TYPES:
            raise serializers.ValidationError(
                f"Unsupported source type. Allowed: {', '.join(sorted(ALLOWED_SOURCE_TYPES))}."
            )
        app_label, model = key.split('.')
        return ContentType.objects.get_by_natural_key(app_label, model)


class ManualExpenseSerializer(serializers.Serializer):
    """Input for POST /api/interactions/expenses/manual/."""

    subject = serializers.CharField(required=True, allow_blank=False, max_length=500)
    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True, min_value=Decimal("0")
    )
    supplier = serializers.CharField(required=False, allow_blank=True, default="")
    occurred_at = serializers.DateTimeField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    zone_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, allow_empty=True, default=list
    )


class RenovationSerializer(serializers.Serializer):
    """Input for POST /api/interactions/renovation/ (create a renovation log entry)."""

    element = serializers.ChoiceField(choices=[])
    interaction_type = serializers.ChoiceField(choices=[], required=False, default="installation")
    product = serializers.CharField(required=False, allow_blank=True, default="")
    brand = serializers.CharField(required=False, allow_blank=True, default="")
    reference = serializers.CharField(required=False, allow_blank=True, default="")
    subject = serializers.CharField(required=False, allow_blank=True, max_length=500)
    occurred_at = serializers.DateTimeField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    zone_ids = serializers.ListField(
        child=serializers.UUIDField(), required=True, allow_empty=False
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Choices are sourced from the service so both stay in sync.
        from .services import RENOVATION_ELEMENTS, RENOVATION_TYPES

        self.fields["element"].choices = [(key, key) for key in RENOVATION_ELEMENTS]
        self.fields["interaction_type"].choices = [(key, key) for key in sorted(RENOVATION_TYPES)]


class RenovationUpdateSerializer(RenovationSerializer):
    """Input for PATCH renovation — every field optional, zones optional."""

    element = serializers.ChoiceField(choices=[], required=False)
    zone_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, allow_empty=False
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
    source_type = SourceContentTypeField(
        source='source_content_type', required=False, allow_null=True
    )
    source_id = serializers.UUIDField(
        source='source_object_id', required=False, allow_null=True
    )
    source_label = serializers.SerializerMethodField()
    zone_names = serializers.SerializerMethodField()
    zone_id_list = serializers.SerializerMethodField()
    document_count = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    linked_document_ids = serializers.SerializerMethodField()
    contacts = serializers.SerializerMethodField()
    structures = serializers.SerializerMethodField()
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
    contacts = serializers.SerializerMethodField()
    structures = serializers.SerializerMethodField()
    equipments = serializers.SerializerMethodField()
    contact_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False,
        allow_empty=True,
    )
    structure_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False,
        allow_empty=True,
    )
    equipment_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False,
        allow_empty=True,
    )

    class Meta:
        model = Interaction
        fields = [
            'id', 'household', 'subject', 'content', 'type',
            'is_private', 'occurred_at', 'tags', 'tags_input', 'metadata', 'enriched_text',
            'source_type', 'source_id', 'source_label',
            'zone_ids', 'zone_names', 'zone_id_list', 'document_count', 'linked_document_ids', 'document_ids',
            'contacts', 'contact_ids', 'structures', 'structure_ids',
            'equipments', 'equipment_ids',
            'created_at', 'updated_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['id', 'household', 'created_at', 'updated_at', 'created_by']

    def validate(self, data):
        data = super().validate(data)
        if not data.get('occurred_at') and not (self.instance and self.instance.occurred_at):
            raise serializers.ValidationError({'occurred_at': 'This field is required.'})

        has_ct = 'source_content_type' in data
        has_oid = 'source_object_id' in data
        if has_ct or has_oid:
            ct = data['source_content_type'] if has_ct else getattr(self.instance, 'source_content_type', None)
            oid = data['source_object_id'] if has_oid else getattr(self.instance, 'source_object_id', None)
            if (ct is None) != (oid is None):
                raise serializers.ValidationError(
                    {'source_id': 'source_type and source_id must be provided together.'}
                )
        return data

    def _validate_source_in_household(self, source_ct, source_object_id, household_id):
        """The linked source object must exist in the interaction's household."""
        if source_ct is None or source_object_id is None:
            return
        model = source_ct.model_class()
        if not model.objects.filter(pk=source_object_id, household_id=household_id).exists():
            raise serializers.ValidationError(
                {'source_id': 'Source object not found in this household.'}
            )

    def get_source_label(self, obj):
        source = obj.source
        if source is None:
            return None
        return getattr(source, 'name', None) or getattr(source, 'title', None) or str(source)

    def get_zone_names(self, obj):
        return [zone.name for zone in obj.zones.all()]

    def get_zone_id_list(self, obj):
        return [str(zone.id) for zone in obj.zones.all()]

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

    def get_contacts(self, obj):
        return [
            {
                'id': str(link.contact_id),
                'name': f"{link.contact.first_name}{' ' + link.contact.last_name if link.contact.last_name else ''}".strip(),
            }
            for link in obj.interaction_contacts.select_related('contact').all()
        ]

    def get_structures(self, obj):
        return [
            {'id': str(link.structure_id), 'name': link.structure.name}
            for link in obj.interaction_structures.select_related('structure').all()
        ]

    def get_equipments(self, obj):
        return [
            {'id': str(link.equipment_id), 'name': link.equipment.name}
            for link in obj.equipment_interactions.select_related('equipment').all()
        ]

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
    
    def _sync_contacts(self, interaction, contact_ids):
        if contact_ids is None:
            return
        from directory.models import Contact
        interaction.interaction_contacts.all().delete()
        for contact_id in contact_ids:
            contact = Contact.objects.filter(id=contact_id, household=interaction.household).first()
            if contact is not None:
                InteractionContact.objects.create(interaction=interaction, contact=contact)

    def _sync_structures(self, interaction, structure_ids):
        if structure_ids is None:
            return
        from directory.models import Structure
        interaction.interaction_structures.all().delete()
        for structure_id in structure_ids:
            structure = Structure.objects.filter(id=structure_id, household=interaction.household).first()
            if structure is not None:
                InteractionStructure.objects.create(interaction=interaction, structure=structure)

    def _sync_equipments(self, interaction, equipment_ids):
        if equipment_ids is None:
            return
        from equipment.models import Equipment, EquipmentInteraction
        interaction.equipment_interactions.all().delete()
        for equipment_id in equipment_ids:
            equipment = Equipment.objects.filter(id=equipment_id, household=interaction.household).first()
            if equipment is not None:
                EquipmentInteraction.objects.create(equipment=equipment, interaction=interaction)

    def create(self, validated_data):
        tag_names = validated_data.pop('tags_input', [])
        zone_ids = validated_data.pop('zone_ids', [])
        document_ids = validated_data.pop('document_ids', [])
        contact_ids = validated_data.pop('contact_ids', [])
        structure_ids = validated_data.pop('structure_ids', [])
        equipment_ids = validated_data.pop('equipment_ids', [])

        self._validate_source_in_household(
            validated_data.get('source_content_type'),
            validated_data.get('source_object_id'),
            validated_data.get('household_id') or getattr(validated_data.get('household'), 'id', None),
        )

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
            self._sync_contacts(interaction, contact_ids)
            self._sync_structures(interaction, structure_ids)
            self._sync_equipments(interaction, equipment_ids)

        return interaction

    def update(self, instance, validated_data):
        tag_names = validated_data.pop('tags_input', None)
        zone_ids = validated_data.pop('zone_ids', None)
        validated_data.pop('document_ids', None)
        contact_ids = validated_data.pop('contact_ids', None)
        structure_ids = validated_data.pop('structure_ids', None)
        equipment_ids = validated_data.pop('equipment_ids', None)

        self._validate_source_in_household(
            validated_data.get('source_content_type', instance.source_content_type),
            validated_data.get('source_object_id', instance.source_object_id),
            instance.household_id,
        )

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
        self._sync_contacts(instance, contact_ids)
        self._sync_structures(instance, structure_ids)
        self._sync_equipments(instance, equipment_ids)

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