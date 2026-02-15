from rest_framework import serializers

from .models import TodoItem


class TodoItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = TodoItem
        fields = ["id", "title", "urgent", "description", "done", "done_at", "owner", "created_at"]
        read_only_fields = ["id", "owner", "created_at"]
