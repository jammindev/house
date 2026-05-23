"""
Stock low/out-of-stock notifications.

Side-effect of stock-altering views (adjust, purchase). Detects transitions
to LOW_STOCK or OUT_OF_STOCK and sends a notification to every active
household member.
"""
from __future__ import annotations

from django.utils.translation import gettext as _

from households.models import HouseholdMember
from notifications.models import Notification
from notifications.service import send

from .models import StockItem


def notify_stock_status_change(item: StockItem, old_status: str, new_status: str) -> int:
    """
    Send a notification when a stock item transitions to LOW_STOCK or OUT_OF_STOCK.

    Returns the number of notifications created (0 if no transition).
    No-op when the status didn't change or moved back up.
    """
    if old_status == new_status:
        return 0
    if new_status == StockItem.Status.OUT_OF_STOCK:
        notif_type = Notification.Type.STOCK_OUT
        title = _("Out of stock: %(name)s") % {"name": item.name}
        body = _("This item is now out of stock. Restock or update its status.")
    elif new_status == StockItem.Status.LOW_STOCK:
        notif_type = Notification.Type.STOCK_LOW
        title = _("Low stock: %(name)s") % {"name": item.name}
        body = _("This item has crossed its minimum quantity threshold.")
    else:
        return 0

    payload = {
        "item_id": str(item.id),
        "item_name": item.name,
        "quantity": str(item.quantity),
        "min_quantity": str(item.min_quantity) if item.min_quantity is not None else None,
        "unit": item.unit,
    }

    members = HouseholdMember.objects.filter(household=item.household).select_related("user")
    created = 0
    for member in members:
        send(
            member.user,
            notification_type=notif_type,
            title=title,
            body=body,
            payload=payload,
        )
        created += 1
    return created
