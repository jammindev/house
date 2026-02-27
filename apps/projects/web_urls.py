from django.urls import path

from .views_web import app_projects_view

urlpatterns = [
    path('', app_projects_view, name='app_projects'),
]
