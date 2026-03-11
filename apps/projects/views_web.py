from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils.translation import gettext_lazy as _

from core.permissions import resolve_request_household
from core.views import ReactPageView
from zones.models import Zone

from .models import Project, ProjectGroup
from .serializers import ProjectGroupSerializer, ProjectSerializer


def _resolve_selected_household(request):
    selected_household = resolve_request_household(request, required=False)
    if selected_household:
        return selected_household
    membership = (
        request.user.householdmember_set
        .select_related("household")
        .order_by("household__name")
        .first()
    )
    return membership.household if membership else None


def _groups_payload(household):
    return [
        {"id": str(g.id), "name": g.name}
        for g in ProjectGroup.objects.filter(household=household).order_by("name")
    ] if household else []


def _zones_payload(request, selected_household):
    zones_queryset = Zone.objects.for_user_households(request.user).select_related("parent")
    if selected_household:
        zones_queryset = zones_queryset.filter(household=selected_household)
    return [
        {
            "id": str(zone.id),
            "name": zone.name,
            "full_path": zone.full_path,
            "color": zone.color,
        }
        for zone in zones_queryset.order_by("name")
    ]


class AppProjectsView(ReactPageView):
    react_root_id = "projects-list-root"
    props_script_id = "projects-list-props"
    page_vite_asset = "src/pages/projects/list.tsx"

    def get_props(self):
        search = (self.request.GET.get("search") or "").strip()
        status = (self.request.GET.get("status") or "").strip()
        proj_type = (self.request.GET.get("type") or "").strip()
        group_id = (self.request.GET.get("group") or "").strip()

        selected_household = _resolve_selected_household(self.request)

        projects_qs = (
            Project.objects
            .for_user_households(self.request.user)
            .select_related("project_group")
            .prefetch_related("project_zones__zone")
        )
        if selected_household:
            projects_qs = projects_qs.filter(household=selected_household)
        if search:
            projects_qs = projects_qs.filter(title__icontains=search)
        if status:
            projects_qs = projects_qs.filter(status=status)
        if proj_type:
            projects_qs = projects_qs.filter(type=proj_type)
        if group_id:
            projects_qs = projects_qs.filter(project_group_id=group_id)

        projects_data = ProjectSerializer(
            projects_qs, many=True, context={"request": self.request}
        ).data
        # Sort: pinned first (mirrors the React sort)
        sorted_projects = sorted(projects_data, key=lambda p: (0 if p["is_pinned"] else 1))

        groups_qs = (
            ProjectGroup.objects
            .filter(household=selected_household)
            .order_by("name")
            .prefetch_related("projects")
        ) if selected_household else ProjectGroup.objects.none()
        groups_data = ProjectGroupSerializer(
            groups_qs, many=True, context={"request": self.request}
        ).data

        return {
            "initialSearch": search,
            "initialStatus": status,
            "initialType": proj_type,
            "initialGroupId": group_id,
            "initialItems": sorted_projects,
            "initialGroups": list(groups_data),
        }


class AppProjectsNewView(ReactPageView):
    react_root_id = "projects-form-root"
    props_script_id = "projects-form-props"
    page_vite_asset = "src/pages/projects/new.tsx"

    def get_props(self):
        selected_household = _resolve_selected_household(self.request)
        return {
            "mode": "create",
            "initialGroups": _groups_payload(selected_household),
            "initialGroupsLoaded": True,
            "initialZones": _zones_payload(self.request, selected_household),
            "initialZonesLoaded": True,
            "cancelUrl": reverse("app_projects"),
            "successRedirectUrl": reverse("app_projects"),
        }


class AppProjectsDetailView(ReactPageView):
    react_root_id = "projects-detail-root"
    props_script_id = "projects-detail-props"
    page_vite_asset = "src/pages/projects/detail.tsx"

    def get_props(self):
        project = get_object_or_404(
            Project.objects.for_user_households(self.request.user).select_related("project_group"),
            id=self.kwargs["project_id"],
        )
        return {
            "projectId": str(project.id),
            "editUrl": reverse("app_projects_edit", kwargs={"project_id": project.id}),
            "listUrl": reverse("app_projects"),
        }


class AppProjectsEditView(ReactPageView):
    react_root_id = "projects-form-root"
    props_script_id = "projects-form-props"
    page_vite_asset = "src/pages/projects/edit.tsx"

    def get_props(self):
        project = get_object_or_404(
            Project.objects.for_user_households(self.request.user),
            id=self.kwargs["project_id"],
        )
        selected_household = _resolve_selected_household(self.request)
        household = selected_household or project.household
        return {
            "mode": "edit",
            "projectId": str(project.id),
            "initialGroups": _groups_payload(household),
            "initialGroupsLoaded": True,
            "initialZones": _zones_payload(self.request, household),
            "initialZonesLoaded": True,
            "cancelUrl": reverse("app_projects_detail", kwargs={"project_id": project.id}),
            "successRedirectUrl": reverse("app_projects_detail", kwargs={"project_id": project.id}),
        }


class AppProjectGroupsView(ReactPageView):
    react_root_id = "project-groups-root"
    props_script_id = "project-groups-props"
    page_vite_asset = "src/pages/projects/groups.tsx"

    def get_props(self):
        return {
            "projectsUrl": reverse("app_projects"),
        }


class AppProjectGroupDetailView(ReactPageView):
    react_root_id = "project-group-detail-root"
    props_script_id = "project-group-detail-props"
    page_vite_asset = "src/pages/projects/group-detail.tsx"

    def get_props(self):
        group = get_object_or_404(
            ProjectGroup.objects.filter(
                household_id__in=self.request.user.householdmember_set.values_list("household_id", flat=True)
            ),
            id=self.kwargs["group_id"],
        )
        return {
            "groupId": str(group.id),
            "backUrl": reverse("app_project_groups"),
            "editUrl": None,
        }
