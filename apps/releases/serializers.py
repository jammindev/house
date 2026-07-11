from rest_framework import serializers

from .models import ChangelogEntry, ChangelogState


class ChangelogEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = ChangelogEntry
        fields = [
            "id",
            "commit_sha",
            "pr_number",
            "module",
            "change_type",
            "summary",
            "raw_subject",
            "committed_at",
        ]


class ChangelogStateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChangelogState
        fields = ["head_sha", "head_committed_at", "generated_at"]
