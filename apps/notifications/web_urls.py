from django.urls import path
from .views_web import (
    NotificationListView,
    NotificationBellFragment,
    MarkReadWeb,
    MarkAllReadWeb,
    DeleteNotificationWeb,
)

urlpatterns = [
    path("", NotificationListView.as_view(), name="app_notifications"),
    path("bell/", NotificationBellFragment.as_view(), name="notification_bell"),
    path("<uuid:pk>/mark-read/", MarkReadWeb.as_view(), name="notification-mark-read-web"),
    path("mark-all-read/", MarkAllReadWeb.as_view(), name="notification-mark-all-read-web"),
    path("<uuid:pk>/delete/", DeleteNotificationWeb.as_view(), name="notification-delete-web"),
]
