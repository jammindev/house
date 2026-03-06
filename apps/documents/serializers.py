"""
Document serializers for REST API.
"""
from rest_framework import serializers
from .models import Document


class DocumentSerializer(serializers.ModelSerializer):
    """Document list/create serializer."""
    
    created_by_name = serializers.CharField(
        source='created_by.full_name',
        read_only=True
    )
    file_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Document
        fields = [
            'id', 'household', 'file_path', 'name', 'mime_type',
            'type', 'notes', 'ocr_text', 'metadata',
            'interaction', 'created_at', 'created_by', 'created_by_name',
            'file_url'
        ]
        read_only_fields = ['id', 'household', 'created_at', 'created_by']
    
    def get_file_url(self, obj):
        """Return media URL for the file."""
        if not obj.file_path:
            return None
        request = self.context.get('request')
        url = f"/media/{obj.file_path}"
        if request is not None:
            return request.build_absolute_uri(url)
        return url


class DocumentDetailSerializer(DocumentSerializer):
    """Document detail with full metadata."""
    
    interaction_subject = serializers.CharField(
        source='interaction.subject',
        read_only=True
    )
    
    class Meta(DocumentSerializer.Meta):
        fields = DocumentSerializer.Meta.fields + ['interaction_subject']
