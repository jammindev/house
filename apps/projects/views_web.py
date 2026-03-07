from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.views.generic import TemplateView
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
    page_title = _("Projects")
    page_description = _("Manage your renovation, maintenance and other projects.")
    react_root_id = "projects-list-root"
    props_script_id = "projects-list-props"
    page_vite_asset = "src/pages/projects.tsx"

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
            "newUrl": reverse("app_projects_new"),
            "groupsUrl": reverse("app_project_groups"),
        }


class AppProjectsNewView(LoginRequiredMixin, TemplateView):
    template_name = 'projects/app/project_new.html'

    def get_context_data(self, **kwargs):
        selected_household = _resolve_selected_household(self.request)
        projects_form_props = {
            "mode": "create",
            "initialGroups": _groups_payload(selected_household),
            "initialGroupsLoaded": True,
            "initialZones": _zones_payload(self.request, selected_household),
            "initialZonesLoaded": True,
            "cancelUrl": reverse("app_projects"),
            "successRedirectUrl": reverse("app_projects"),
        }
        return super().get_context_data(projects_form_props=projects_form_props, **kwargs)


class AppProjectsDetailView(LoginRequiredMixin, TemplateView):
    template_name = 'projects/app/project_detail.html'

    def get_context_data(self, **kwargs):
        project = get_object_or_404(
            Project.objects.for_user_households(self.request.user).select_related("project_group"),
            id=self.kwargs["project_id"],
        )
        projects_detail_props = {
            "projectId": str(project.id),
            "editUrl": reverse("app_projects_edit", kwargs={"project_id": project.id}),
            "listUrl": reverse("app_projects"),
        }
        return super().get_context_data(projects_detail_props=projects_detail_props, **kwargs)


class AppProjectsEditView(LoginRequiredMixin, TemplateView):
    template_name = 'projects/app/project_edit.html'

    def get_context_data(self, **kwargs):
        project = get_object_or_404(
            Project.objects.for_user_households(self.request.user),
            id=self.kwargs["project_id"],
        )
        selected_household = _resolve_selected_household(self.request)
        household = selected_household or project.household
        projects_form_props = {
            "mode": "edit",
            "projectId": str(project.id),
            "initialGroups": _groups_payload(household),
            "initialGroupsLoaded": True,
            "initialZones": _zones_payload(self.request, household),
            "initialZonesLoaded": True,
            "cancelUrl": reverse("app_projects_detail", kwargs={"project_id": project.id}),
            "successRedirectUrl": reverse("app_projects_detail", kwargs={"project_id": project.id}),
        }
        return super().get_context_data(projects_form_props=projects_form_props, **kwargs)


class AppProjectGroupsView(LoginRequiredMixin, TemplateView):
    template_name = 'projects/app/project_groups.html'

    def get_context_data(self, **kwargs):
        project_groups_props = {
            "projectsUrl": reverse("app_projects"),
        }
        return super().get_context_data(project_groups_props=project_groups_props, **kwargs)


class AppProjectGroupDetailView(LoginRequiredMixin, TemplateView):
    template_name = 'projects/app/project_group_detail.html'

    def get_context_data(self, **kwargs):
        group = get_object_or_404(
            ProjectGroup.objects.filter(
                household_id__in=self.request.user.householdmember_set.values_list("household_id", flat=True)
            ),
            id=self.kwargs["group_id"],
        )
        project_group_detail_props = {
            "groupId": str(group.id),
            "backUrl": reverse("app_project_groups"),
            "editUrl": None,
        }
        return super().get_context_data(project_group_detail_props=project_group_detail_props, **kwargs)
