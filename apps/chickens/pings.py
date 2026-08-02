"""
Proactive pings of the chicken coop: the evening egg count, and overdue chores.

Both are registered as ``PingSpec`` from ``apps.py::ready()`` and ride the
existing ``send_scheduled_pings`` tick — per-user opt-in, local send time,
``PingLog`` idempotence. No new scheduler, no new container.

The egg ping's reply flows through the regular Telegram → ``agent.service.ask``
pipeline and lands in ``services.log_eggs`` via the ``egg_log`` writable — the
upsert makes a second answer the same evening replace the count.

The chore ping follows ``weather/pings.py``: ``build_message`` also drops an
in-app notification (bell + web push) before returning the Telegram text, so a
household that never opens Telegram still gets reminded.
"""
from __future__ import annotations

from datetime import date

from django.utils.translation import gettext as _
from django.utils.translation import ngettext

from .models import Chicken, EggLog

# Notification.type discriminator for the in-app bell. Declared in the enum like
# every other type — `choices` is not enforced by the database, so a literal
# would persist fine and stay invisible to the admin display and MUTABLE_TYPES.
CHORE_NOTIFICATION_TYPE = "chicken_chore_due"


def build_egg_ping(household, user, *, today: date) -> str | None:
    """The evening question, or ``None`` when there is nothing to ask.

    Skips when the flock is empty (nothing to collect) and when today's count
    is already logged (from the app or an earlier reply) — the ping must never
    ask for data the household already entered.
    """
    if not Chicken.objects.filter(
        household=household, status__in=Chicken.FLOCK_STATUSES
    ).exists():
        return None
    if EggLog.objects.filter(household=household, date=today).exists():
        return None
    return _("🥚 How many eggs did you collect today?")


def build_chore_ping(household, user, *, today: date) -> str | None:
    """The overdue-chore reminder, or ``None`` when nothing is due.

    Side effect on a firing reminder: an in-app notification for ``user``,
    deduped on the household-local day so a Telegram retry never produces a
    second bell entry.

    One message for all due chores, never one per chore: a household that let
    four chores slip would otherwise get four pings the same evening, and four
    notifications about the coop is how a reminder becomes noise.
    """
    from .services import overdue_chores

    rows = overdue_chores(household, today=today)
    if not rows:
        return None

    lines = []
    for chore, state in rows:
        label = f"{chore.emoji} {chore.name}".strip() if chore.emoji else chore.name
        if state['never_done']:
            lines.append(_("• {name} — never done").format(name=label))
        elif state['days_overdue'] == 0:
            lines.append(_("• {name} — due today").format(name=label))
        else:
            lines.append(
                ngettext(
                    "• {name} — {days} day late",
                    "• {name} — {days} days late",
                    state['days_overdue'],
                ).format(name=label, days=state['days_overdue'])
            )

    header = ngettext(
        "🧹 {count} coop chore needs doing:",
        "🧹 {count} coop chores need doing:",
        len(rows),
    ).format(count=len(rows))
    message = "\n".join([header, *lines])

    _notify_bell(household, user, today, rows, message)
    return message


def _notify_bell(household, user, today: date, rows, message: str) -> None:
    from notifications.service import send

    day = today.isoformat()
    send(
        user,
        CHORE_NOTIFICATION_TYPE,
        title=ngettext(
            "A coop chore is due",
            "%(count)d coop chores are due",
            len(rows),
        ) % {"count": len(rows)},
        body=message,
        # Keyed on the day, not on the chores: the point is "you were told about
        # the coop today", and a set of ids would re-notify the moment a fifth
        # chore slips — which is precisely when the household needs it least.
        dedup_key=f"chicken_chore:{day}",
        url="/app/chickens",
        payload={
            "household_id": str(household.id),
            "day": day,
            "chore_ids": [str(chore.id) for chore, _state in rows],
        },
    )
