from rest_framework.routers import DefaultRouter
from .views import TaskViewSet, TaskDocumentViewSet, TaskInteractionViewSet

router = DefaultRouter()
router.register(r'tasks', TaskViewSet, basename='task')
router.register(r'task-documents', TaskDocumentViewSet, basename='task-document')
router.register(r'task-interactions', TaskInteractionViewSet, basename='task-interaction')

urlpatterns = router.urls
