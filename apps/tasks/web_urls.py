from django.urls import path

from .views_web import app_tasks_view

urlpatterns = [
    path('', app_tasks_view, name='app_tasks'),
]
