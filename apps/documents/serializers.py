"""Document serializers for REST API."""
from rest_framework import serializers

from .models import Document


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


class DocumentUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    type = serializers.ChoiceField(
        choices=[(value, label) for value, label in Document.DOCUMENT_TYPES if value != 'photo'],
        required=False,
        allow_null=True,
    )
    notes = serializers.CharField(required=False, allow_blank=True)
class DocumentSerializer(serializers.ModelSerializer):
    """Document list/create serializer."""

    created_by_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    qualification = serializers.SerializerMethodField()
    linked_interactions = serializers.SerializerMethodField()
    legacy_interaction = serializers.SerializerMethodField()
    legacy_interaction_subject = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            'id', 'household', 'file_path', 'name', 'mime_type',
            'type', 'notes', 'ocr_text', 'metadata',
            'interaction', 'created_at', 'created_by', 'created_by_name',
            'file_url', 'qualification', 'linked_interactions',
            'legacy_interaction', 'legacy_interaction_subject',
        ]
        read_only_fields = ['id', 'household', 'created_at', 'created_by']

    def get_created_by_name(self, obj):
        return obj.created_by.full_name if obj.created_by else ''

    def get_file_url(self, obj):
        """Return media URL for the file."""
        if not obj.file_path:
            return None
        request = self.context.get('request')
        url = f"/media/{obj.file_path}"
        if request is not None:
            return request.build_absolute_uri(url)
        return url

    def _linked_interactions_payload(self, obj):
        links = getattr(obj, 'prefetched_interaction_documents', None)
        if links is None:
            links = obj.interaction_documents.select_related('interaction').all()

        payload = []
        seen = set()
        for link in links:
            interaction = getattr(link, 'interaction', None)
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
        zone_links = getattr(obj, 'prefetched_zone_documents', None)
        project_links = getattr(obj, 'prefetched_project_documents', None)
        if zone_links is not None or project_links is not None:
            return bool(zone_links) or bool(project_links)
        return obj.zonedocument_set.exists() or obj.project_documents.exists()

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
    recent_interaction_candidates = serializers.SerializerMethodField()

    class Meta(DocumentSerializer.Meta):
        fields = DocumentSerializer.Meta.fields + [
            'interaction_subject',
            'zone_links',
            'project_links',
            'recent_interaction_candidates',
        ]

    def get_interaction_subject(self, obj):
        return obj.interaction.subject if obj.interaction_id and obj.interaction else None

    def get_zone_links(self, obj):
        zone_links = getattr(obj, 'prefetched_zone_documents', None)
        if zone_links is None:
            zone_links = obj.zonedocument_set.select_related('zone').all()
        payload = [
            {
                'zone_id': str(link.zone_id),
                'zone_name': link.zone.name,
            }
            for link in zone_links
            if getattr(link, 'zone', None)
        ]
        return ZoneLinkSummarySerializer(payload, many=True).data

    def get_project_links(self, obj):
        project_links = getattr(obj, 'prefetched_project_documents', None)
        if project_links is None:
            project_links = obj.project_documents.select_related('project').all()
        payload = [
            {
                'project_id': str(link.project_id),
                'project_name': link.project.title,
            }
            for link in project_links
            if getattr(link, 'project', None)
        ]
        return ProjectLinkSummarySerializer(payload, many=True).data

    def get_recent_interaction_candidates(self, obj):
        candidates = self.context.get('recent_interaction_candidates') or []
        return LinkedInteractionSummarySerializer(candidates, many=True).data


class DocumentUploadResponseSerializer(serializers.Serializer):
    document = DocumentDetailSerializer()
    detail_url = serializers.CharField()
