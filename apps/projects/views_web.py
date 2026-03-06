from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.views.generic import TemplateView

from core.permissions import resolve_request_household
from zones.models import Zone

from .models import Project, ProjectGroup


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


class AppProjectsView(LoginRequiredMixin, TemplateView):
    template_name = 'projects/app/projects.html'

    def get_context_data(self, **kwargs):
        projects_list_props = {
            "initialSearch": (self.request.GET.get("search") or "").strip(),
            "initialStatus": (self.request.GET.get("status") or "").strip(),
            "initialType": (self.request.GET.get("type") or "").strip(),
            "initialGroupId": (self.request.GET.get("group") or "").strip(),
            "newUrl": reverse("app_projects_new"),
            "groupsUrl": reverse("app_project_groups"),
        }
        return super().get_context_data(projects_list_props=projects_list_props, **kwargs)


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
