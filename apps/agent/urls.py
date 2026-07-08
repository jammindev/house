"""Agent URLs."""
from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import AgentMemoryViewSet, AskView, ConversationViewSet

router = DefaultRouter()
router.register(r"conversations", ConversationViewSet, basename="agent-conversation")
router.register(r"memories", AgentMemoryViewSet, basename="agent-memory")

urlpatterns = [
    path("ask/", AskView.as_view(), name="agent-ask"),
    *router.urls,
]
