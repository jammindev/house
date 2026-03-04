from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import ContactViewSet, AddressViewSet, EmailViewSet, PhoneViewSet, StructureViewSet

router = DefaultRouter()
router.register(r"structures", StructureViewSet, basename="structure")
router.register(r"contacts", ContactViewSet, basename="contact")
router.register(r"addresses", AddressViewSet, basename="address")
router.register(r"emails", EmailViewSet, basename="email")
router.register(r"phones", PhoneViewSet, basename="phone")

urlpatterns = [
    path("", include(router.urls)),
]
