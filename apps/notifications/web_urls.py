from django.urls import path
from .views_web import notification_list_view, notification_bell_fragment

urlpatterns = [
    path("", notification_list_view, name="app_notifications"),
    path("bell/", notification_bell_fragment, name="notification_bell"),
]
