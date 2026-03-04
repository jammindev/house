from django.urls import path

from .views_web import app_contacts_view

urlpatterns = [
    path('', app_contacts_view, name='app_contacts'),
]
