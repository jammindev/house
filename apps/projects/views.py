from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from core.permissions import IsHouseholdMember, resolve_request_household
from .models import Project, ProjectGroup, ProjectZone, ProjectAIThread, ProjectAIMessage, UserPinnedProject
from .serializers import (
    ProjectSerializer,
    ProjectGroupSerializer,
    ProjectZoneSerializer,
    ProjectAIThreadSerializer,
    ProjectAIMessageSerializer,
)


class _HouseholdScopedViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsHouseholdMember]

    def get_queryset(self):
        queryset = self.model.objects.for_user_households(self.request.user)
        selected_household = resolve_request_household(self.request, required=False)
        if selected_household:
            queryset = queryset.filter(household=selected_household)
        return queryset

    def perform_create(self, serializer):
        household = resolve_request_household(self.request, required=True)
        if not household:
            raise ValidationError({"household_id": "A valid household context is required."})
        serializer.save(household=household, created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class ProjectGroupViewSet(_HouseholdScopedViewSet):
    model = ProjectGroup
    serializer_class = ProjectGroupSerializer


class ProjectViewSet(_HouseholdScopedViewSet):
    model = Project
    serializer_class = ProjectSerializer

    @action(detail=True, methods=["post"], url_path="pin")
    def pin(self, request, pk=None):
        project = self.get_object()
        household = resolve_request_household(request, required=False) or project.household
        member = request.user.householdmember_set.filter(household=household).first()
        if not member:
            raise ValidationError({"detail": "No household membership found."})
        UserPinnedProject.objects.get_or_create(household_member=member, project=project)
        serializer = self.get_serializer(project)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="unpin")
    def unpin(self, request, pk=None):
        project = self.get_object()
        household = resolve_request_household(request, required=False) or project.household
        member = request.user.householdmember_set.filter(household=household).first()
        if member:
            UserPinnedProject.objects.filter(household_member=member, project=project).delete()
        serializer = self.get_serializer(project)
        return Response(serializer.data)


class ProjectZoneViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsHouseholdMember]
    serializer_class = ProjectZoneSerializer

    def get_queryset(self):
        queryset = ProjectZone.objects.filter(
            project__household_id__in=self.request.user.householdmember_set.values_list("household_id", flat=True)
        )
        selected_household = resolve_request_household(self.request, required=False)
        if selected_household:
            queryset = queryset.filter(project__household=selected_household)
        return queryset

    def perform_create(self, serializer):
        project = serializer.validated_data["project"]
        zone = serializer.validated_data["zone"]
        if project.household_id != zone.household_id:
            raise ValidationError({"zone": "Zone household must match project household."})
        serializer.save(created_by=self.request.user)


class ProjectAIThreadViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsHouseholdMember]
    serializer_class = ProjectAIThreadSerializer

    def get_queryset(self):
        queryset = ProjectAIThread.objects.filter(
            household_id__in=self.request.user.householdmember_set.values_list("household_id", flat=True)
        )
        selected_household = resolve_request_household(self.request, required=False)
        if selected_household:
            queryset = queryset.filter(household=selected_household)
        return queryset

    def perform_create(self, serializer):
        household = resolve_request_household(self.request, required=True)
        if not household:
            raise ValidationError({"household_id": "A valid household context is required."})
        serializer.save(household=household, user=self.request.user)


class ProjectAIMessageViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsHouseholdMember]
    serializer_class = ProjectAIMessageSerializer

    def get_queryset(self):
        queryset = ProjectAIMessage.objects.filter(
            thread__household_id__in=self.request.user.householdmember_set.values_list("household_id", flat=True)
        )
        selected_household = resolve_request_household(self.request, required=False)
        if selected_household:
            queryset = queryset.filter(thread__household=selected_household)
        return queryset
