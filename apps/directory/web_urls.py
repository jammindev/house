from django.urls import path

from .views_web import (
    app_contacts_view,
    app_contact_new_view,
    app_contact_detail_view,
    app_contact_edit_view,
    app_structure_new_view,
    app_structure_detail_view,
    app_structure_edit_view,
)

urlpatterns = [
    path('', app_contacts_view, name='app_directory'),
    path('contacts/new/', app_contact_new_view, name='app_contact_new'),
    path('contacts/<uuid:pk>/', app_contact_detail_view, name='app_contact_detail'),
    path('contacts/<uuid:pk>/edit/', app_contact_edit_view, name='app_contact_edit'),
    path('structures/new/', app_structure_new_view, name='app_structure_new'),
    path('structures/<uuid:pk>/', app_structure_detail_view, name='app_structure_detail'),
    path('structures/<uuid:pk>/edit/', app_structure_edit_view, name='app_structure_edit'),
]
