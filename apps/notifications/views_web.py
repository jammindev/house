from django.contrib.auth.decorators import login_required
from django.shortcuts import render

from .models import Notification


@login_required
def notification_list_view(request):
    notifications = Notification.objects.filter(user=request.user).order_by("-created_at")[:50]
    unread_count = Notification.objects.filter(user=request.user, is_read=False).count()
    return render(request, "notifications/app/list.html", {
        "section": "notifications",
        "notifications": notifications,
        "unread_count": unread_count,
    })


@login_required
def notification_bell_fragment(request):
    """HTMX fragment — just the bell icon + badge count."""
    count = Notification.objects.filter(user=request.user, is_read=False).count()
    return render(request, "notifications/_bell.html", {"unread_count": count})
