from django.utils import timezone
from rest_framework import status as drf_status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from core.permissions import IsHouseholdMember
from documents.mixins import DocumentLinkActionsMixin
from interactions.services import create_expense_interaction
from .models import (
    Project,
    ProjectGroup,
    ProjectZone,
    UserPinnedProject,
)
from .serializers import (
    ProjectSerializer,
    ProjectGroupSerializer,
    ProjectPurchaseSerializer,
    ProjectZoneSerializer,
)
from .services import annotate_actual_cost


class _HouseholdScopedViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsHouseholdMember]

    def get_queryset(self):
        queryset = self.model.objects.for_user_households(self.request.user)
        selected_household = self.request.household
        if selected_household:
            queryset = queryset.filter(household=selected_household)
        return queryset

    def perform_create(self, serializer):
        household = self.request.household
        if not household:
            raise ValidationError({"household_id": "A valid household context is required."})
        serializer.save(household=household, created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class ProjectGroupViewSet(_HouseholdScopedViewSet):
    model = ProjectGroup
    serializer_class = ProjectGroupSerializer


class ProjectViewSet(DocumentLinkActionsMixin, _HouseholdScopedViewSet):
    model = Project
    serializer_class = ProjectSerializer
    document_link_role = "supporting"

    def get_queryset(self):
        queryset = super().get_queryset()
        zone_id = self.request.query_params.get('zone', '').strip()
        if zone_id:
            queryset = queryset.filter(project_zones__zone_id=zone_id).distinct()
        status = self.request.query_params.get('status', '').strip()
        if status:
            queryset = queryset.filter(status=status)
        return annotate_actual_cost(queryset)

    def perform_create(self, serializer):
        household = self.request.household
        if not household:
            raise ValidationError({"household_id": "A valid household context is required."})

        project_group = serializer.validated_data.get("project_group")
        cover_interaction = serializer.validated_data.get("cover_interaction")

        if project_group and project_group.household_id != household.id:
            raise ValidationError({"project_group": "Project group household must match selected household."})

        if cover_interaction and cover_interaction.household_id != household.id:
            raise ValidationError({"cover_interaction": "Cover interaction household must match selected household."})

        serializer.save(household=household, created_by=self.request.user)

    def perform_update(self, serializer):
        household = self.request.household or serializer.instance.household
        project_group = serializer.validated_data.get("project_group", serializer.instance.project_group)
        cover_interaction = serializer.validated_data.get("cover_interaction", serializer.instance.cover_interaction)

        if project_group and project_group.household_id != household.id:
            raise ValidationError({"project_group": "Project group household must match selected household."})

        if cover_interaction and cover_interaction.household_id != household.id:
            raise ValidationError({"cover_interaction": "Cover interaction household must match selected household."})

        serializer.save(updated_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="register-purchase")
    def register_purchase(self, request, pk=None):
        """Create an Interaction(type=expense) linked to the project.

        The project's actual cost is computed from its expense interactions
        (#234) — this endpoint only creates the interaction, nothing to sync.
        """
        project = self.get_object()
        serializer = ProjectPurchaseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        interaction = create_expense_interaction(
            source=project,
            user=request.user,
            amount=serializer.validated_data.get("amount"),
            supplier=serializer.validated_data.get("supplier", "") or "",
            occurred_at=serializer.validated_data.get("occurred_at") or timezone.now(),
            notes=serializer.validated_data.get("notes", "") or "",
            kind="project_purchase",
            extra_metadata={"project_title": project.title},
        )

        # Re-fetch through the annotated queryset so the response includes the
        # freshly created expense in actual_cost_cached.
        project = self.get_queryset().get(pk=project.pk)
        payload = ProjectSerializer(project, context={"request": request}).data
        payload["interaction_id"] = str(interaction.id)
        return Response(payload, status=drf_status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="pin")
    def pin(self, request, pk=None):
        project = self.get_object()
        household = request.household or project.household
        member = request.user.householdmember_set.filter(household=household).first()
        if not member:
            raise ValidationError({"detail": "No household membership found."})
        UserPinnedProject.objects.get_or_create(household_member=member, project=project)
        serializer = self.get_serializer(project)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="unpin")
    def unpin(self, request, pk=None):
        project = self.get_object()
        household = request.household or project.household
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
        selected_household = self.request.household
        if selected_household:
            queryset = queryset.filter(project__household=selected_household)
        return queryset

    def perform_create(self, serializer):
        project = serializer.validated_data["project"]
        zone = serializer.validated_data["zone"]
        if not Project.objects.for_user_households(self.request.user).filter(id=project.id).exists():
            raise ValidationError({"project": "Invalid project or access denied."})
        if not zone.__class__.objects.for_user_households(self.request.user).filter(id=zone.id).exists():
            raise ValidationError({"zone": "Invalid zone or access denied."})
        if project.household_id != zone.household_id:
            raise ValidationError({"zone": "Zone household must match project household."})
        serializer.save(created_by=self.request.user)
