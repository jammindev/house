from django.shortcuts import get_object_or_404

from core.views import ReactPageView

from .models import Project, ProjectGroup


_SPA_ROOT_ID = "projects-spa-root"
_SPA_PROPS_ID = "projects-spa-props"
_SPA_ASSET = "src/pages/projects/index.tsx"


class AppProjectsView(ReactPageView):
    react_root_id = _SPA_ROOT_ID
    props_script_id = _SPA_PROPS_ID
    page_vite_asset = _SPA_ASSET

    def get_props(self):
        return {
            "route": "list",
            "routeData": {},
        }


class AppProjectsNewView(ReactPageView):
    react_root_id = _SPA_ROOT_ID
    props_script_id = _SPA_PROPS_ID
    page_vite_asset = _SPA_ASSET

    def get_props(self):
        return {
            "route": "new",
            "routeData": {},
        }


class AppProjectsDetailView(ReactPageView):
    react_root_id = _SPA_ROOT_ID
    props_script_id = _SPA_PROPS_ID
    page_vite_asset = _SPA_ASSET

    def get_props(self):
        project = get_object_or_404(
            Project.objects.for_user_households(self.request.user).select_related("project_group"),
            id=self.kwargs["project_id"],
        )
        return {
            "route": "detail",
            "routeData": {
                "projectId": str(project.id),
            },
        }


class AppProjectsEditView(ReactPageView):
    react_root_id = _SPA_ROOT_ID
    props_script_id = _SPA_PROPS_ID
    page_vite_asset = _SPA_ASSET

    def get_props(self):
        project = get_object_or_404(
            Project.objects.for_user_households(self.request.user),
            id=self.kwargs["project_id"],
        )
        return {
            "route": "edit",
            "routeData": {
                "projectId": str(project.id),
            },
        }


class AppProjectGroupsView(ReactPageView):
    react_root_id = _SPA_ROOT_ID
    props_script_id = _SPA_PROPS_ID
    page_vite_asset = _SPA_ASSET

    def get_props(self):
        return {
            "route": "groups",
            "routeData": {},
        }


class AppProjectGroupDetailView(ReactPageView):
    react_root_id = _SPA_ROOT_ID
    props_script_id = _SPA_PROPS_ID
    page_vite_asset = _SPA_ASSET

    def get_props(self):
        group = get_object_or_404(
            ProjectGroup.objects.filter(
                household_id__in=self.request.user.householdmember_set.values_list("household_id", flat=True)
            ),
            id=self.kwargs["group_id"],
        )
        return {
            "route": "group-detail",
            "routeData": {
                "groupId": str(group.id),
            },
        }
