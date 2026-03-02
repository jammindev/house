from django.contrib.auth.decorators import login_required
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.views.decorators.http import require_POST

from .models import Notification
from .service import BELL_REFRESH_EVENT


@login_required
def notification_list_view(request):
    notifications = Notification.objects.filter(
        user=request.user, deleted_at__isnull=True
    ).order_by("-created_at")[:50]
    unread_count = Notification.objects.filter(
        user=request.user, is_read=False, deleted_at__isnull=True
    ).count()
    return render(request, "notifications/app/list.html", {
        "section": "notifications",
        "notifications": notifications,
        "unread_count": unread_count,
    })


@login_required
def notification_bell_fragment(request):
    """HTMX fragment — just the bell icon + badge count."""
    count = Notification.objects.filter(user=request.user, is_read=False, deleted_at__isnull=True).count()
    return render(request, "notifications/_bell.html", {"unread_count": count})


@login_required
@require_POST
def mark_read_web(request, pk):
    """HTMX — mark one notification as read, swap the <li> + refresh bell."""
    notif = get_object_or_404(Notification, pk=pk, user=request.user)
    notif.is_read = True
    notif.read_at = timezone.now()
    notif.save(update_fields=["is_read", "read_at"])
    response = render(request, "notifications/partials/_notification_item.html", {"notif": notif})
    response["HX-Trigger"] = BELL_REFRESH_EVENT
    return response


@login_required
@require_POST
def mark_all_read_web(request):
    """HTMX — mark all notifications as read, reload the list + refresh bell."""
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


@login_required
@require_POST
def delete_notification_web(request, pk):
    """HTMX — soft-delete one notification, remove the <li> + refresh bell."""
    notif = get_object_or_404(Notification, pk=pk, user=request.user)
    notif.deleted_at = timezone.now()
    notif.save(update_fields=["deleted_at"])
    # Return empty string so HTMX outerHTML swap removes the <li>
    response = HttpResponse("")
    response["HX-Trigger"] = BELL_REFRESH_EVENT
    return response
