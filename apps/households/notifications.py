"""Notifications emitted by the household's own lifecycle.

Kept out of `services.py` for the same reason `stock/notifications.py` exists:
a side-effect that reaches other users is worth reading on its own, and the
service module is already the place where the *membership* invariants live.
"""
from __future__ import annotations

from django.utils import translation
from django.utils.translation import gettext as _

from notifications.models import Notification
from notifications.service import send

from .models import HouseholdMember


def notify_member_joined(household, joiner) -> int:
    """Tell the household that `joiner` just came in. Returns how many were told.

    **Everybody but the newcomer** — not just whoever clicked invite. `invited_by`
    is `SET_NULL` and may be gone, a link is shareable by hand so it often has no
    addressee at all, and "somebody joined the foyer" is a fact the whole
    household reads rather than a receipt owed to one person.

    Each notification is rendered under **its own recipient's** locale: one
    household can mix languages, and the text is stored in plain form (see the
    write-time localisation rule in `CLAUDE.md`), so a single `gettext` around
    the loop would post everyone the language of whoever happened to accept —
    with no second chance at display time.
    """
    joiner_name = joiner.display_name or joiner.email
    payload = {
        "household_id": str(household.id),
        "household_name": household.name,
        "member_id": str(joiner.id),
        "member_name": joiner_name,
    }

    recipients = (
        HouseholdMember.objects
        .filter(household=household)
        .exclude(user=joiner)
        .select_related("user")
    )

    told = 0
    for member in recipients:
        with translation.override(getattr(member.user, "locale", None) or "en"):
            title = _("%(member)s joined %(household)s") % {
                "member": joiner_name,
                "household": household.name,
            }
            body = _("They now have access to the household.")
        send(
            member.user,
            notification_type=Notification.Type.HOUSEHOLD_MEMBER_JOINED,
            title=title,
            body=body,
            payload=payload,
        )
        told += 1
    return told
