from django.urls import path

from .views_web import app_settings_view

urlpatterns = [
    path('', app_settings_view, name='app_settings'),
]
