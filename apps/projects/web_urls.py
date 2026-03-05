from django.urls import path

from .views_web import (
    app_projects_view,
    app_projects_new_view,
    app_projects_detail_view,
    app_projects_edit_view,
    app_project_groups_view,
    app_project_group_detail_view,
)

urlpatterns = [
    path('', app_projects_view, name='app_projects'),
    path('new/', app_projects_new_view, name='app_projects_new'),
    path('<uuid:project_id>/', app_projects_detail_view, name='app_projects_detail'),
    path('<uuid:project_id>/edit/', app_projects_edit_view, name='app_projects_edit'),
    path('groups/', app_project_groups_view, name='app_project_groups'),
    path('groups/<uuid:group_id>/', app_project_group_detail_view, name='app_project_group_detail'),
]
