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


class ZonePickerSerializer(serializers.ModelSerializer):
    """Minimal serializer for zone picker dropdowns in forms (snake_case)."""
    full_path = serializers.ReadOnlyField()

    class Meta:
        model = Zone
        fields = ['id', 'name', 'full_path', 'color']


class ZonePickerDetailSerializer(serializers.ModelSerializer):
    """Zone picker with parent info and depth, for forms that need hierarchy."""
    full_path = serializers.ReadOnlyField()
    depth = serializers.ReadOnlyField()
    parentId = serializers.UUIDField(source='parent_id', allow_null=True, read_only=True)

    class Meta:
        model = Zone
        fields = ['id', 'name', 'parentId', 'full_path', 'color', 'depth']


class ZoneListPropsSerializer(serializers.ModelSerializer):
    """Serializer for the zones list page props (camelCase keys)."""
    full_path = serializers.ReadOnlyField()
    fullPath = serializers.ReadOnlyField(source='full_path')
    parentId = serializers.UUIDField(source='parent_id', allow_null=True, read_only=True)

    class Meta:
        model = Zone
        fields = ['id', 'name', 'fullPath', 'color', 'parentId']


class ZoneDetailPropsSerializer(serializers.ModelSerializer):
    """Serializer for the zone detail page initialZone prop (camelCase keys)."""
    parentId = serializers.UUIDField(source='parent_id', allow_null=True, read_only=True)
    parentName = serializers.SerializerMethodField()
    surface = serializers.SerializerMethodField()
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)

    class Meta:
        model = Zone
        fields = ['id', 'name', 'parentId', 'parentName', 'note', 'surface', 'color', 'updatedAt']

    def get_parentName(self, obj):
        return obj.parent.name if obj.parent else None

    def get_surface(self, obj):
        return float(obj.surface) if obj.surface is not None else None


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
