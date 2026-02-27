from django.urls import path

from .views_web import app_equipment_view

urlpatterns = [
    path('', app_equipment_view, name='app_equipment'),
]
