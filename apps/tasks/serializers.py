from rest_framework import serializers
from interactions.models import Interaction


class TaskPropsSerializer(serializers.ModelSerializer):
    project_title = serializers.CharField(source='project.title', read_only=True, default=None)
    zone_names = serializers.SerializerMethodField()
    document_count = serializers.SerializerMethodField()

    class Meta:
        model = Interaction
        fields = [
            'id', 'subject', 'content', 'status',
            'occurred_at', 'created_at',
            'project', 'project_title',
            'zone_names', 'metadata', 'document_count',
        ]

    def get_zone_names(self, obj):
        return [zone.name for zone in obj.zones.all()]

    def get_document_count(self, obj):
        ids = {str(d) for d in obj.interaction_documents.values_list('document_id', flat=True)}
        ids.update(str(d) for d in obj.documents.values_list('id', flat=True))
        return len(ids)
