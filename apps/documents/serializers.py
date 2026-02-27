"""
Document serializers for REST API.
"""
from rest_framework import serializers
from .models import Document


class DocumentSerializer(serializers.ModelSerializer):
    """Document list/create serializer."""
    
    created_by_name = serializers.CharField(
        source='created_by.get_full_name',
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
        """Generate signed URL for file (to implement with storage backend)."""
        # TODO: Implement signed URL generation
        return f"/storage/{obj.file_path}"


class DocumentDetailSerializer(DocumentSerializer):
    """Document detail with full metadata."""
    
    interaction_subject = serializers.CharField(
        source='interaction.subject',
        read_only=True
    )
    
    class Meta(DocumentSerializer.Meta):
        fields = DocumentSerializer.Meta.fields + ['interaction_subject']
