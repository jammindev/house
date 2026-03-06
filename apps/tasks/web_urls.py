from django.urls import path

from .views_web import AppTasksView

urlpatterns = [
    path('', AppTasksView.as_view(), name='app_tasks'),
]
