"""
Accounts URLs — auth + users API.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import AuthViewSet, UserViewSet, me_view

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="user")
router.register(r"auth", AuthViewSet, basename="auth")

urlpatterns = [
    path("me/", me_view, name="accounts-me"),
    path("", include(router.urls)),
]
