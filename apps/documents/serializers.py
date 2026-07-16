"""Document serializers for REST API."""
from rest_framework import serializers

from .models import Document
from .thumbnails import THUMBNAIL_SIZES, thumbnail_exists, thumbnail_storage_path


class DocumentQualificationSerializer(serializers.Serializer):
    has_activity_context = serializers.BooleanField()
    qualification_state = serializers.ChoiceField(choices=['without_activity', 'activity_linked'])
    linked_interactions_count = serializers.IntegerField()
    has_secondary_context = serializers.BooleanField()


class LinkedInteractionSummarySerializer(serializers.Serializer):
    id = serializers.CharField()
    subject = serializers.CharField()
    type = serializers.CharField()
    occurred_at = serializers.DateTimeField()


class ZoneLinkSummarySerializer(serializers.Serializer):
    zone_id = serializers.CharField()
    zone_name = serializers.CharField()


class ProjectLinkSummarySerializer(serializers.Serializer):
    project_id = serializers.CharField()
    project_name = serializers.CharField()


class EntityLinkSummarySerializer(serializers.Serializer):
    """Generic backlink: any household entity a document is attached to."""
    entity_type = serializers.CharField()
    id = serializers.CharField()
    label = serializers.CharField()
    url_path = serializers.CharField()


class DocumentUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    type = serializers.ChoiceField(
        choices=Document.DOCUMENT_TYPES,
        required=False,
        allow_null=True,
    )
    notes = serializers.CharField(required=False, allow_blank=True)
    is_private = serializers.BooleanField(required=False, default=False)
    zone = serializers.UUIDField(required=False, allow_null=True)

class DocumentSerializer(serializers.ModelSerializer):
    """Document list/create serializer."""

    created_by_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    medium_url = serializers.SerializerMethodField()
    qualification = serializers.SerializerMethodField()
    linked_interactions = serializers.SerializerMethodField()
    legacy_interaction = serializers.SerializerMethodField()
    legacy_interaction_subject = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            'id', 'household', 'file_path', 'name', 'mime_type',
            'type', 'notes', 'ocr_text', 'metadata', 'is_private',
            'interaction', 'created_at', 'created_by', 'created_by_name',
            'file_url', 'thumbnail_url', 'medium_url',
            'qualification', 'linked_interactions',
            'legacy_interaction', 'legacy_interaction_subject',
        ]
        read_only_fields = ['id', 'household', 'created_at', 'created_by']

    def get_created_by_name(self, obj):
        return obj.created_by.full_name if obj.created_by else ''

    def _build_media_url(self, path):
        url = f"/media/{path}"
        request = self.context.get('request')
        if request is not None:
            return request.build_absolute_uri(url)
        return url

    def get_file_url(self, obj):
        """Return media URL for the file."""
        if not obj.file_path:
            return None
        return self._build_media_url(obj.file_path)

    def _get_thumbnail_url(self, obj, size):
        if not obj.file_path or size not in THUMBNAIL_SIZES:
            return None
        if not thumbnail_exists(obj.file_path, size):
            return None
        return self._build_media_url(thumbnail_storage_path(obj.file_path, size))

    def get_thumbnail_url(self, obj):
        return self._get_thumbnail_url(obj, 'thumb')

    def get_medium_url(self, obj):
        return self._get_thumbnail_url(obj, 'medium')

    def _document_links(self, obj):
        links = getattr(obj, 'prefetched_links', None)
        if links is None:
            links = list(obj.links.select_related('content_type').all())
        return links

    def _linked_interactions_payload(self, obj):
        payload = []
        seen = set()
        for link in self._document_links(obj):
            if link.content_type.model != 'interaction':
                continue
            interaction = link.entity
            if not interaction or interaction.id in seen:
                continue
            seen.add(interaction.id)
            payload.append(
                {
                    'id': str(interaction.id),
                    'subject': interaction.subject,
                    'type': interaction.type,
                    'occurred_at': interaction.occurred_at,
                }
            )
        return payload

    def _has_secondary_context(self, obj):
        return any(
            link.content_type.model in ('zone', 'project')
            for link in self._document_links(obj)
        )

    def get_qualification(self, obj):
        linked_interactions = self._linked_interactions_payload(obj)
        has_activity_context = bool(linked_interactions)
        payload = {
            'has_activity_context': has_activity_context,
            'qualification_state': 'activity_linked' if has_activity_context else 'without_activity',
            'linked_interactions_count': len(linked_interactions),
            'has_secondary_context': self._has_secondary_context(obj),
        }
        return DocumentQualificationSerializer(payload).data

    def get_linked_interactions(self, obj):
        return LinkedInteractionSummarySerializer(self._linked_interactions_payload(obj), many=True).data

    def get_legacy_interaction(self, obj):
        return str(obj.interaction_id) if obj.interaction_id else None

    def get_legacy_interaction_subject(self, obj):
        return obj.interaction.subject if obj.interaction_id and obj.interaction else None


class DocumentDetailSerializer(DocumentSerializer):
    """Document detail with qualification and secondary context summaries."""

    interaction_subject = serializers.SerializerMethodField()
    zone_links = serializers.SerializerMethodField()
    project_links = serializers.SerializerMethodField()
    entity_links = serializers.SerializerMethodField()
    recent_interaction_candidates = serializers.SerializerMethodField()

    class Meta(DocumentSerializer.Meta):
        fields = DocumentSerializer.Meta.fields + [
            'interaction_subject',
            'zone_links',
            'project_links',
            'entity_links',
            'recent_interaction_candidates',
        ]

    def get_interaction_subject(self, obj):
        return obj.interaction.subject if obj.interaction_id and obj.interaction else None

    def get_zone_links(self, obj):
        payload = []
        for link in self._document_links(obj):
            if link.content_type.model != 'zone':
                continue
            zone = link.entity
            if zone is None:
                continue
            payload.append({'zone_id': str(zone.id), 'zone_name': zone.name})
        return ZoneLinkSummarySerializer(payload, many=True).data

    def get_project_links(self, obj):
        payload = []
        for link in self._document_links(obj):
            if link.content_type.model != 'project':
                continue
            project = link.entity
            if project is None:
                continue
            payload.append({'project_id': str(project.id), 'project_name': project.title})
        return ProjectLinkSummarySerializer(payload, many=True).data

    def get_entity_links(self, obj):
        from .services import entity_links_for_document
        return EntityLinkSummarySerializer(entity_links_for_document(obj), many=True).data

    def get_recent_interaction_candidates(self, obj):
        candidates = self.context.get('recent_interaction_candidates') or []
        return LinkedInteractionSummarySerializer(candidates, many=True).data


class DocumentUploadResponseSerializer(serializers.Serializer):
    document = DocumentDetailSerializer()
    detail_url = serializers.CharField()
