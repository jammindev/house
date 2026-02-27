from django.urls import path

from .views_web import app_interaction_new_view, app_interactions_view

urlpatterns = [
    path("", app_interactions_view, name="app_interactions"),
    path("new/", app_interaction_new_view, name="app_interaction_new"),
]
