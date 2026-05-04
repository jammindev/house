from decimal import Decimal

from rest_framework import serializers

from zones.models import Zone

from .models import (
    Project,
    ProjectGroup,
    ProjectZone,
    ProjectAIThread,
    ProjectAIMessage,
    UserPinnedProject,
)


class ProjectPurchaseSerializer(serializers.Serializer):
    """Input for /projects/{id}/register-purchase/."""

    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True, min_value=Decimal("0")
    )
    supplier = serializers.CharField(required=False, allow_blank=True, default="")
    occurred_at = serializers.DateTimeField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class ProjectGroupPickerSerializer(serializers.ModelSerializer):
    """Minimal serializer for group picker dropdowns in forms."""

    class Meta:
        model = ProjectGroup
        fields = ["id", "name"]


class ProjectGroupSerializer(serializers.ModelSerializer):
    projects_count = serializers.SerializerMethodField()

    class Meta:
        model = ProjectGroup
        fields = [
            "id",
            "household",
            "name",
            "description",
            "tags",
            "projects_count",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["id", "household", "created_at", "updated_at", "created_by", "updated_by"]

    def get_projects_count(self, obj):
        return obj.projects.count()


class ProjectSerializer(serializers.ModelSerializer):
    is_pinned = serializers.SerializerMethodField()
    zones = serializers.SerializerMethodField()
    zone_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False,
    )
    project_group_name = serializers.SerializerMethodField()
    # Le modèle a default="" mais pas blank=True : DRF rejette les chaînes vides
    # par défaut. Le formulaire React envoie systématiquement description="" quand
    # l'utilisateur n'écrit rien — rendre le champ optionnel + blank-OK ici.
    description = serializers.CharField(required=False, allow_blank=True, default="")

    class Meta:
        model = Project
        fields = [
            "id",
            "household",
            "title",
            "description",
            "status",
            "priority",
            "start_date",
            "due_date",
            "closed_at",
            "tags",
            "planned_budget",
            "actual_cost_cached",
            "cover_interaction",
            "project_group",
            "project_group_name",
            "type",
            "is_pinned",
            "zones",
            "zone_ids",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["id", "household", "created_at", "updated_at", "created_by", "updated_by"]

    def get_is_pinned(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return UserPinnedProject.objects.filter(
            project=obj,
            household_member__user=request.user,
            household_member__household=obj.household,
        ).exists()

    def get_zones(self, obj):
        return [
            {"id": str(pz.zone.id), "name": pz.zone.name, "color": pz.zone.color}
            for pz in obj.project_zones.select_related("zone").all()
        ]

    def get_project_group_name(self, obj):
        return obj.project_group.name if obj.project_group else None

    def create(self, validated_data):
        zone_ids = validated_data.pop("zone_ids", None)
        project = super().create(validated_data)
        if zone_ids is not None:
            self._sync_zones(project, zone_ids)
        return project

    def update(self, instance, validated_data):
        zone_ids = validated_data.pop("zone_ids", None)
        project = super().update(instance, validated_data)
        if zone_ids is not None:
            self._sync_zones(project, zone_ids)
        return project

    def _sync_zones(self, project, zone_ids):
        request = self.context.get("request")
        ids = [str(z) for z in zone_ids]
        zones = list(Zone.objects.for_user_households(request.user).filter(id__in=ids))
        if len(zones) != len(set(ids)):
            raise serializers.ValidationError(
                {"zone_ids": "One or more zones are invalid or inaccessible."}
            )
        for z in zones:
            if z.household_id != project.household_id:
                raise serializers.ValidationError(
                    {"zone_ids": "Zone household must match project household."}
                )
        existing = set(str(pk) for pk in project.project_zones.values_list("zone_id", flat=True))
        desired = set(ids)
        to_remove = existing - desired
        to_add = desired - existing
        if to_remove:
            project.project_zones.filter(zone_id__in=to_remove).delete()
        for zone_id in to_add:
            ProjectZone.objects.create(
                project=project,
                zone_id=zone_id,
                created_by=request.user if request else None,
            )


class ProjectZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectZone
        fields = ["project", "zone", "created_at", "created_by"]
        read_only_fields = ["created_at", "created_by"]


class ProjectAIThreadSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectAIThread
        fields = [
            "id",
            "project",
            "household",
            "user",
            "title",
            "created_at",
            "updated_at",
            "archived_at",
        ]
        read_only_fields = ["id", "household", "user", "created_at", "updated_at"]


class ProjectAIMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectAIMessage
        fields = ["id", "thread", "role", "content", "metadata", "created_at"]
        read_only_fields = ["id", "created_at"]
