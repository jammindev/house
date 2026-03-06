from django.urls import path

from .views_web import (
    AppProjectsView,
    AppProjectsNewView,
    AppProjectsDetailView,
    AppProjectsEditView,
    AppProjectGroupsView,
    AppProjectGroupDetailView,
)

urlpatterns = [
    path('', AppProjectsView.as_view(), name='app_projects'),
    path('new/', AppProjectsNewView.as_view(), name='app_projects_new'),
    path('<uuid:project_id>/', AppProjectsDetailView.as_view(), name='app_projects_detail'),
    path('<uuid:project_id>/edit/', AppProjectsEditView.as_view(), name='app_projects_edit'),
    path('groups/', AppProjectGroupsView.as_view(), name='app_project_groups'),
    path('groups/<uuid:group_id>/', AppProjectGroupDetailView.as_view(), name='app_project_group_detail'),
]
