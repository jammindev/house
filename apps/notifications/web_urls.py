from django.urls import path
from .views_web import (
    notification_list_view,
    notification_bell_fragment,
    mark_read_web,
    mark_all_read_web,
    delete_notification_web,
)

urlpatterns = [
    path("", notification_list_view, name="app_notifications"),
    path("bell/", notification_bell_fragment, name="notification_bell"),
    path("<uuid:pk>/mark-read/", mark_read_web, name="notification-mark-read-web"),
    path("mark-all-read/", mark_all_read_web, name="notification-mark-all-read-web"),
    path("<uuid:pk>/delete/", delete_notification_web, name="notification-delete-web"),
]
