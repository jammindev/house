"""
Stock low/out-of-stock notifications.

Side-effect of stock-altering views (adjust, purchase). Detects transitions
to LOW_STOCK or OUT_OF_STOCK and sends a notification to every active
household member.
"""
from __future__ import annotations

from django.utils.translation import gettext as _

from notifications.models import Notification
from notifications.service import notify_household

from .models import StockItem


def notify_stock_status_change(item: StockItem, old_status: str, new_status: str) -> int:
    """
    Send a notification when a stock item transitions to LOW_STOCK or OUT_OF_STOCK.

    Returns the number of notifications created (0 if no transition).
    No-op when the status didn't change or moved back up.

    No actor: crossing a threshold is a fact about the household's stock, not
    somebody's action — whoever took the last packet needs telling too.
    """
    if old_status == new_status:
        return 0
    if new_status == StockItem.Status.OUT_OF_STOCK:
        notif_type = Notification.Type.STOCK_OUT

        def text():
            return (
                _("Out of stock: %(name)s") % {"name": item.name},
                _("This item is now out of stock. Restock or update its status."),
            )
    elif new_status == StockItem.Status.LOW_STOCK:
        notif_type = Notification.Type.STOCK_LOW

        def text():
            return (
                _("Low stock: %(name)s") % {"name": item.name},
                _("This item has crossed its minimum quantity threshold."),
            )
    else:
        return 0

    return len(notify_household(
        item.household,
        notif_type,
        text=text,
        # The item, not the list: "Low stock: coffee" that lands on 200 rows of
        # inventory makes the reader do the search the notification already did.
        url=f"/app/stock/{item.id}",
        # One live warning per item per state. Adjusting a quantity twice under
        # the threshold used to post the same sentence twice. The key frees when
        # the user dismisses the notification — deliberately not when the item
        # recovers and drops again: the bell would then hold two entries saying
        # the same true thing.
        dedup_key=f"stock:{item.id}:{new_status}",
        payload={
            "item_id": str(item.id),
            "item_name": item.name,
            "quantity": str(item.quantity),
            "min_quantity": str(item.min_quantity) if item.min_quantity is not None else None,
            "unit": item.unit,
        },
    ))
