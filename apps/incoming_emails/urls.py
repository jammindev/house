from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import IncomingEmailViewSet, IncomingEmailAttachmentViewSet

router = DefaultRouter()
router.register(r"incoming-emails", IncomingEmailViewSet, basename="incoming-email")
router.register(r"incoming-email-attachments", IncomingEmailAttachmentViewSet, basename="incoming-email-attachment")

urlpatterns = [
    path("", include(router.urls)),
]
