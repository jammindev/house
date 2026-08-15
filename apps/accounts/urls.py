"""
Accounts URLs — auth + users API.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    AuthViewSet,
    DeviceTokenViewSet,
    SetupView,
    UserViewSet,
    me_view,
    signup_availability_view,
)

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="user")
router.register(r"auth", AuthViewSet, basename="auth")
router.register(r"devices", DeviceTokenViewSet, basename="device-token")

urlpatterns = [
    path("me/", me_view, name="accounts-me"),
    path(
        "signup-availability/",
        signup_availability_view,
        name="accounts-signup-availability",
    ),
    # L'assistant de premier démarrage. Public, et il doit le rester : c'est le
    # seul chemin d'entrée d'une instance qui n'a encore aucun compte.
    path("setup/", SetupView.as_view(), name="accounts-setup"),
    path("", include(router.urls)),
]
