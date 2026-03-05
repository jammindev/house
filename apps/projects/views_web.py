from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, render
from django.urls import reverse

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


@login_required
def app_projects_view(request):
    selected_household = _resolve_selected_household(request)

    projects_list_props = {
        "householdId": str(selected_household.id) if selected_household else None,
        "initialSearch": (request.GET.get("search") or "").strip(),
        "initialStatus": (request.GET.get("status") or "").strip(),
        "initialType": (request.GET.get("type") or "").strip(),
        "initialGroupId": (request.GET.get("group") or "").strip(),
        "newUrl": reverse("app_projects_new"),
        "groupsUrl": reverse("app_project_groups"),
    }

    return render(
        request,
        "projects/app/projects.html",
        {"projects_list_props": projects_list_props},
    )


@login_required
def app_projects_new_view(request):
    selected_household = _resolve_selected_household(request)

    projects_form_props = {
        "mode": "create",
        "householdId": str(selected_household.id) if selected_household else None,
        "initialGroups": _groups_payload(selected_household),
        "initialGroupsLoaded": True,
        "initialZones": _zones_payload(request, selected_household),
        "initialZonesLoaded": True,
        "cancelUrl": reverse("app_projects"),
        "successRedirectUrl": reverse("app_projects"),
    }

    return render(
        request,
        "projects/app/project_new.html",
        {"projects_form_props": projects_form_props},
    )


@login_required
def app_projects_detail_view(request, project_id):
    project = get_object_or_404(
        Project.objects.for_user_households(request.user).select_related("project_group"),
        id=project_id,
    )
    selected_household = _resolve_selected_household(request)
    household = selected_household or project.household

    projects_detail_props = {
        "projectId": str(project.id),
        "householdId": str(household.id),
        "editUrl": reverse("app_projects_edit", kwargs={"project_id": project.id}),
        "listUrl": reverse("app_projects"),
    }

    return render(
        request,
        "projects/app/project_detail.html",
        {"projects_detail_props": projects_detail_props},
    )


@login_required
def app_projects_edit_view(request, project_id):
    project = get_object_or_404(
        Project.objects.for_user_households(request.user),
        id=project_id,
    )
    selected_household = _resolve_selected_household(request)
    household = selected_household or project.household

    projects_form_props = {
        "mode": "edit",
        "projectId": str(project.id),
        "householdId": str(household.id),
        "initialGroups": _groups_payload(household),
        "initialGroupsLoaded": True,
        "initialZones": _zones_payload(request, household),
        "initialZonesLoaded": True,
        "cancelUrl": reverse("app_projects_detail", kwargs={"project_id": project.id}),
        "successRedirectUrl": reverse("app_projects_detail", kwargs={"project_id": project.id}),
    }

    return render(
        request,
        "projects/app/project_edit.html",
        {"projects_form_props": projects_form_props},
    )


@login_required
def app_project_groups_view(request):
    selected_household = _resolve_selected_household(request)

    project_groups_props = {
        "householdId": str(selected_household.id) if selected_household else None,
        "projectsUrl": reverse("app_projects"),
    }

    return render(
        request,
        "projects/app/project_groups.html",
        {"project_groups_props": project_groups_props},
    )


@login_required
def app_project_group_detail_view(request, group_id):
    group = get_object_or_404(
        ProjectGroup.objects.filter(
            household_id__in=request.user.householdmember_set.values_list("household_id", flat=True)
        ),
        id=group_id,
    )
    selected_household = _resolve_selected_household(request)

    project_group_detail_props = {
        "groupId": str(group.id),
        "householdId": str(selected_household.id) if selected_household else str(group.household_id),
        "backUrl": reverse("app_project_groups"),
        "editUrl": None,
    }

    return render(
        request,
        "projects/app/project_group_detail.html",
        {"project_group_detail_props": project_group_detail_props},
    )
