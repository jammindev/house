from django.utils import timezone
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import TodoItem
from .serializers import TodoItemSerializer


class TodoItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = TodoItemSerializer

    def get_queryset(self):
        return TodoItem.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        instance = serializer.save()
        if instance.done and instance.done_at is None:
            instance.done_at = timezone.now()
            instance.save(update_fields=["done_at"])
        if not instance.done and instance.done_at is not None:
            instance.done_at = None
            instance.save(update_fields=["done_at"])
