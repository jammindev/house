from django.urls import path

from .views_web import (
    AppContactsView,
    AppContactNewView,
    AppContactDetailView,
    AppContactEditView,
    AppStructureNewView,
    AppStructureDetailView,
    AppStructureEditView,
)

urlpatterns = [
    path('', AppContactsView.as_view(), name='app_directory'),
    path('contacts/new/', AppContactNewView.as_view(), name='app_contact_new'),
    path('contacts/<uuid:pk>/', AppContactDetailView.as_view(), name='app_contact_detail'),
    path('contacts/<uuid:pk>/edit/', AppContactEditView.as_view(), name='app_contact_edit'),
    path('structures/new/', AppStructureNewView.as_view(), name='app_structure_new'),
    path('structures/<uuid:pk>/', AppStructureDetailView.as_view(), name='app_structure_detail'),
    path('structures/<uuid:pk>/edit/', AppStructureEditView.as_view(), name='app_structure_edit'),
]
