"""
Zones serializers.
"""
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from .models import Zone
from .queries import CLOSED_TASK_STATUSES


class ZoneSerializer(serializers.ModelSerializer):
    """Serializer for zones.

    Les compteurs de contenu (`equipment_count`, `open_task_count`,
    `active_project_count`, `children_count`) sont lus depuis l'annotation posée
    par ``zones.queries.with_content_counts`` — c'est le chemin normal. Le repli
    par requête n'existe que pour les instances non annotées (création, détail
    récupéré via `get_object`) ; il ne doit jamais devenir le chemin d'une liste,
    sinon on retombe sur un N+1 par zone.
    """
    full_path = serializers.ReadOnlyField()
    depth = serializers.ReadOnlyField()
    # Le modèle ne protège la surface que par un CheckConstraint : sans borne ici,
    # une surface négative remonte en IntegrityError 500 au lieu d'un 400 lisible.
    surface = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=0,
        required=False, allow_null=True,
    )
    children_count = serializers.SerializerMethodField()
    equipment_count = serializers.SerializerMethodField()
    open_task_count = serializers.SerializerMethodField()
    active_project_count = serializers.SerializerMethodField()
    parent_name = serializers.SerializerMethodField()

    class Meta:
        model = Zone
        fields = [
            'id', 'household', 'name', 'parent', 'parent_name', 'note', 'surface', 'color',
            'full_path', 'depth', 'children_count',
            'equipment_count', 'open_task_count', 'active_project_count',
            'created_at', 'updated_at', 'created_by', 'updated_by'
        ]
        read_only_fields = ['id', 'household', 'created_at', 'updated_at', 'created_by', 'updated_by']

    @staticmethod
    def _counted(obj, attname, fallback):
        """Annotation si elle est là, sinon repli par requête.

        Une annotation atterrit dans ``obj.__dict__`` — et vaut ``None`` quand la
        sous-requête corrélée n'a trouvé aucune ligne, d'où la normalisation à 0.
        Aucun de ces noms n'est un champ ni une property du modèle : leur présence
        dans ``__dict__`` signe donc bien l'annotation.
        """
        if attname in obj.__dict__:
            return obj.__dict__[attname] or 0
        return fallback()

    def get_children_count(self, obj):
        return self._counted(obj, 'children_count', lambda: obj.children.count())

    def get_equipment_count(self, obj):
        return self._counted(obj, 'equipment_count', lambda: obj.equipment.count())

    def get_open_task_count(self, obj):
        return self._counted(
            obj,
            'open_task_count',
            lambda: obj.tasks.exclude(status__in=CLOSED_TASK_STATUSES).count(),
        )

    def get_active_project_count(self, obj):
        return self._counted(
            obj,
            'active_project_count',
            lambda: obj.project_zones.filter(project__status='active').count(),
        )

    def get_parent_name(self, obj):
        return obj.parent.name if obj.parent_id and obj.parent else None

    def validate(self, data):
        """Validate parent belongs to same household."""
        if 'parent' in data and data['parent']:
            request = self.context.get('request')
            target_household_id = None

            if self.instance is not None:
                target_household_id = self.instance.household_id

            if target_household_id is None and request is not None:
                household = getattr(request, 'household', None)
                if household:
                    target_household_id = household.id
                else:
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
        """Recursively serialize children (annotés, pour éviter le repli N+1)."""
        from .queries import with_content_counts

        children = with_content_counts(obj.children.all())
        return ZoneTreeSerializer(children, many=True, context=self.context).data


class ZoneDocumentSerializer(serializers.Serializer):
    """Serializer for a zone's document links (backed by DocumentLink).

    Shape preserved from the former ZoneDocument model serializer so the zone
    photos frontend is unaffected.
    """
    zone = serializers.SerializerMethodField()
    document = serializers.IntegerField(source='document_id', read_only=True)
    document_name = serializers.CharField(source='document.name', read_only=True)
    document_file_path = serializers.CharField(source='document.file_path', read_only=True)
    role = serializers.CharField(read_only=True)
    note = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)

    def get_zone(self, obj):
        return str(obj.object_id)
