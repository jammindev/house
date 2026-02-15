"""
Interaction URLs.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import InteractionViewSet, InteractionContactViewSet, InteractionStructureViewSet

router = DefaultRouter()
router.register(r'interactions', InteractionViewSet, basename='interaction')
router.register(r'interaction-contacts', InteractionContactViewSet, basename='interaction-contact')
router.register(r'interaction-structures', InteractionStructureViewSet, basename='interaction-structure')

urlpatterns = [
    path('', include(router.urls)),
]