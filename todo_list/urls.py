from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import TodoItemViewSet

router = DefaultRouter()
router.register(r"", TodoItemViewSet, basename="todo-item")

urlpatterns = [
    path("", include(router.urls)),
]
