"""Notifications emitted by the household's own lifecycle.

Kept out of `services.py` for the same reason `stock/notifications.py` exists:
a side-effect that reaches other users is worth reading on its own, and the
service module is already the place where the *membership* invariants live.
"""
from __future__ import annotations

from django.utils.translation import gettext as _

from notifications.models import Notification
from notifications.service import notify_household


def notify_member_joined(household, joiner) -> int:
    """Tell the household that `joiner` just came in. Returns how many were told.

    **Everybody but the newcomer** — not just whoever clicked invite. `invited_by`
    is `SET_NULL` and may be gone, a link is shareable by hand so it often has no
    addressee at all, and "somebody joined the foyer" is a fact the whole
    household reads rather than a receipt owed to one person.

    The fan-out, the actor exclusion and the per-recipient language all come from
    `notify_household` — this function only knows *what* to say.
    """
    joiner_name = joiner.display_name or joiner.email

    def text():
        return (
            _("%(member)s joined %(household)s")
            % {"member": joiner_name, "household": household.name},
            _("They now have access to the household."),
        )

    told = notify_household(
        household,
        Notification.Type.HOUSEHOLD_MEMBER_JOINED,
        actor=joiner,
        text=text,
        url="/app/settings",
        payload={
            "household_id": str(household.id),
            "household_name": household.name,
            "member_id": str(joiner.id),
            "member_name": joiner_name,
        },
    )
    return len(told)
