"""
Zones serializers.
"""
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from .models import Zone, ZoneDocument


class ZoneSerializer(serializers.ModelSerializer):
    """Serializer for zones."""
    full_path = serializers.ReadOnlyField()
    depth = serializers.ReadOnlyField()
    children_count = serializers.SerializerMethodField()

    class Meta:
        model = Zone
        fields = [
            'id', 'household', 'name', 'parent', 'note', 'surface', 'color',
            'full_path', 'depth', 'children_count',
            'created_at', 'updated_at', 'created_by', 'updated_by'
        ]
        read_only_fields = ['id', 'household', 'created_at', 'updated_at', 'created_by', 'updated_by']

    def get_children_count(self, obj):
        return obj.children.count()

    def validate(self, data):
        """Validate parent belongs to same household."""
        if 'parent' in data and data['parent']:
            request = self.context.get('request')
            target_household_id = None

            if self.instance is not None:
                target_household_id = self.instance.household_id

            if target_household_id is None and request is not None:
                target_household_id = (
                    request.data.get('household_id')
                    or request.query_params.get('household_id')
                    or request.headers.get('X-Household-Id')
                )

            if target_household_id and str(data['parent'].household_id) != str(target_household_id):
                raise serializers.ValidationError({
                    'parent': _("Parent zone must belong to the same household")
                })
        return data


class ZoneTreeSerializer(ZoneSerializer):
    """Nested serializer for zone hierarchy."""
    children = serializers.SerializerMethodField()

    class Meta(ZoneSerializer.Meta):
        fields = ZoneSerializer.Meta.fields + ['children']

    def get_children(self, obj):
        """Recursively serialize children."""
        children = obj.children.all()
        return ZoneTreeSerializer(children, many=True, context=self.context).data


class ZoneDocumentSerializer(serializers.ModelSerializer):
    """Serializer for zone documents."""
    document_name = serializers.CharField(source='document.name', read_only=True)
    document_file_path = serializers.CharField(source='document.file_path', read_only=True)

    class Meta:
        model = ZoneDocument
        fields = [
            'zone', 'document', 'document_name', 'document_file_path',
            'role', 'note', 'created_at', 'created_by'
        ]
        read_only_fields = ['created_at', 'created_by']
