from django import template
from django.urls import reverse
from django.utils.html import format_html

register = template.Library()


@register.simple_tag
def notification_bell(element_id: str = "notification-bell", extra_class: str = "") -> str:
    """
    Render the HTMX notification bell widget div.

    Usage:
        {% load notification_tags %}
        {% notification_bell element_id="notification-bell" extra_class="hidden lg:block" %}
        {% notification_bell element_id="notification-bell-mobile" %}
    """
    bell_url = reverse("notification_bell")
    from notifications.service import BELL_REFRESH_EVENT

    class_attr = format_html(' class="{}"', extra_class) if extra_class else ""

    return format_html(
        '<div id="{}" hx-get="{}" hx-trigger="load, every 30s, {} from:body" hx-swap="innerHTML"{}></div>',
        element_id,
        bell_url,
        BELL_REFRESH_EVENT,
        class_attr,
    )
