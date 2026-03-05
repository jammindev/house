from rest_framework import serializers

from .models import (
    Project,
    ProjectGroup,
    ProjectZone,
    ProjectAIThread,
    ProjectAIMessage,
)


class ProjectGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectGroup
        fields = [
            "id",
            "household",
            "name",
            "description",
            "tags",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by", "updated_by"]


class ProjectSerializer(serializers.ModelSerializer):
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
            "type",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by", "updated_by"]


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
        read_only_fields = ["id", "created_at", "updated_at"]


class ProjectAIMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectAIMessage
        fields = ["id", "thread", "role", "content", "metadata", "created_at"]
        read_only_fields = ["id", "created_at"]
