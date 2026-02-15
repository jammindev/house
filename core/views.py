from rest_framework import viewsets
from rest_framework.permissions import IsAdminUser

from .models import SystemAdmin
from .serializers import SystemAdminSerializer


class SystemAdminViewSet(viewsets.ModelViewSet):
	"""CRUD for legacy system_admins table (staff only)."""

	queryset = SystemAdmin.objects.select_related("user", "granted_by").all()
	serializer_class = SystemAdminSerializer
	permission_classes = [IsAdminUser]

	def perform_create(self, serializer):
		serializer.save(granted_by=self.request.user)
