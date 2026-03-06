from django.urls import path

from .views_web import AppInteractionNewView, AppInteractionsView

urlpatterns = [
    path("", AppInteractionsView.as_view(), name="app_interactions"),
    path("new/", AppInteractionNewView.as_view(), name="app_interaction_new"),
]
