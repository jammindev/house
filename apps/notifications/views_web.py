from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.views.generic import TemplateView, View

from .models import Notification
from .service import BELL_REFRESH_EVENT


class NotificationListView(LoginRequiredMixin, TemplateView):
    template_name = 'notifications/app/list.html'

    def get_context_data(self, **kwargs):
        notifications = Notification.objects.filter(
            user=self.request.user, deleted_at__isnull=True
        ).order_by("-created_at")[:50]
        unread_count = Notification.objects.filter(
            user=self.request.user, is_read=False, deleted_at__isnull=True
        ).count()
        return super().get_context_data(
            section="notifications",
            notifications=notifications,
            unread_count=unread_count,
            **kwargs,
        )


class NotificationBellFragment(LoginRequiredMixin, View):
    """HTMX fragment — just the bell icon + badge count."""

    def get(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False, deleted_at__isnull=True).count()
        return render(request, "notifications/_bell.html", {"unread_count": count})


class MarkReadWeb(LoginRequiredMixin, View):
    """HTMX — mark one notification as read, swap the <li> + refresh bell."""

    def post(self, request, pk):
        notif = get_object_or_404(Notification, pk=pk, user=request.user)
        notif.is_read = True
        notif.read_at = timezone.now()
        notif.save(update_fields=["is_read", "read_at"])
        response = render(request, "notifications/partials/_notification_item.html", {"notif": notif})
        response["HX-Trigger"] = BELL_REFRESH_EVENT
        return response


class MarkAllReadWeb(LoginRequiredMixin, View):
    """HTMX — mark all notifications as read, reload the list + refresh bell."""

    def post(self, request):
        Notification.objects.filter(user=request.user, is_read=False, deleted_at__isnull=True).update(
            is_read=True,
            read_at=timezone.now(),
        )
        notifications = Notification.objects.filter(
            user=request.user, deleted_at__isnull=True
        ).order_by("-created_at")[:50]
        response = render(request, "notifications/app/list.html", {
            "section": "notifications",
            "notifications": notifications,
            "unread_count": 0,
        })
        response["HX-Trigger"] = BELL_REFRESH_EVENT
        return response


class DeleteNotificationWeb(LoginRequiredMixin, View):
    """HTMX — soft-delete one notification, remove the <li> + refresh bell."""

    def post(self, request, pk):
        notif = get_object_or_404(Notification, pk=pk, user=request.user)
        notif.deleted_at = timezone.now()
        notif.save(update_fields=["deleted_at"])
        # Return empty string so HTMX outerHTML swap removes the <li>
        response = HttpResponse("")
        response["HX-Trigger"] = BELL_REFRESH_EVENT
        return response
