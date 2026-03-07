from rest_framework import serializers

from .models import (
    Project,
    ProjectGroup,
    ProjectZone,
    ProjectAIThread,
    ProjectAIMessage,
    UserPinnedProject,
)


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
    project_group_name = serializers.SerializerMethodField()

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
