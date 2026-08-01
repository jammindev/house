from django.apps import AppConfig
from django.db.models import Max


class ChickensConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'chickens'

    def ready(self):
        from agent.listables import ListableSpec, ListFilter, register as register_listable
        from agent.searchables import SearchableSpec, register
        from agent.writables import WritableSpec, register as register_writable
        from .models import Chicken, ChickenChore, ChickenEvent, EggLog

        register(SearchableSpec(
            entity_type='chicken',
            module='chickens',
            model=Chicken,
            search_fields=('name', 'breed', 'notes'),
            label_attr='name',
            url_template='/app/chickens/{id}',
            related=_chicken_related,
        ))

        # Journal entries are citable on their own (e.g. "quand a-t-on vermifugé
        # les poules ?"). No detail page — the deep link opens the module page.
        register(SearchableSpec(
            entity_type='chicken_event',
            module='chickens',
            model=ChickenEvent,
            search_fields=('title', 'notes'),
            label_attr='title',
            url_template='/app/chickens?event={id}',
        ))

        register_writable(WritableSpec(
            entity_type='chicken',
            module='chickens',
            create=_create_chicken_from_agent,
            update=_update_chicken_from_agent,
            updatable_fields=(
                'name', 'breed', 'color', 'status', 'notes', 'hatched_on', 'acquired_on'
            ),
            resolve=_resolve_chicken_for_agent,
            delete=_delete_chicken_from_agent,
            label_attr='name',
            url_template='/app/chickens/{id}',
        ))

        register_writable(WritableSpec(
            entity_type='egg_log',
            module='chickens',
            create=_create_egg_log_from_agent,
            resolve=_resolve_egg_log_for_agent,
            delete=_delete_egg_log_from_agent,
            label_attr=lambda log: f"{log.date.isoformat()}: {log.count}",
            url_template='/app/chickens?egg_log={id}',
        ))

        register_listable(ListableSpec(
            entity_type='chicken',
            module='chickens',
            model=Chicken,
            filters=(
                ListFilter('status', 'comma-separated statuses', _filter_chicken_status),
                ListFilter('in_flock', "'true' = only hens currently in the flock", _filter_in_flock),
            ),
            order_by=('name',),
            describe=_describe_chicken,
        ))

        # Chores are citable ("à quelle fréquence on nettoie le poulailler ?")
        # and the deep link opens the module page, where the panel lives.
        register(SearchableSpec(
            entity_type='chicken_chore',
            module='chickens',
            model=ChickenChore,
            search_fields=('name', 'notes'),
            label_attr='name',
            url_template='/app/chickens?chore={id}',
        ))

        # "J'ai nettoyé le poulailler" is not an edit of the chore — it is a new
        # fact in the journal. Modelling it as its own writable is what makes the
        # undo mean something: it removes the journal entry, and the chore's due
        # date rolls back on its own because it was never stored.
        register_writable(WritableSpec(
            entity_type='chicken_chore_done',
            module='chickens',
            create=_complete_chore_from_agent,
            resolve=_resolve_completion_for_agent,
            delete=_delete_completion_from_agent,
            label_attr='title',
            url_template='/app/chickens?event={id}',
        ))

        register_writable(WritableSpec(
            entity_type='chicken_chore',
            module='chickens',
            create=_create_chore_from_agent,
            update=_update_chore_from_agent,
            updatable_fields=('name', 'emoji', 'interval_days', 'starts_on', 'notes', 'is_active'),
            resolve=_resolve_chore_for_agent,
            delete=_delete_chore_from_agent,
            label_attr='name',
            url_template='/app/chickens?chore={id}',
        ))

        register_listable(ListableSpec(
            entity_type='chicken_chore',
            module='chickens',
            model=ChickenChore,
            filters=(
                ListFilter('due', "'true' = only chores whose due date has passed", _filter_chore_due),
                ListFilter('active', "'false' = include paused chores", _filter_chore_active),
            ),
            order_by=('name',),
            describe=_describe_chore,
        ))

        register_listable(ListableSpec(
            entity_type='egg_log',
            module='chickens',
            model=EggLog,
            filters=(
                ListFilter('date_from', 'date >= YYYY-MM-DD', _filter_date_from),
                ListFilter('date_to', 'date <= YYYY-MM-DD', _filter_date_to),
            ),
            order_by=('-date',),
            describe=_describe_egg_log,
        ))

        from datetime import time as dt_time

        from pings.registry import PingSpec, register as register_ping
        from .pings import build_chore_ping, build_egg_ping

        register_ping(PingSpec(
            ping_type='egg_log',
            module='chickens',
            build_message=build_egg_ping,
            default_send_at=dt_time(19, 0),
        ))

        # Morning by default: a chore reminder is only useful while there is
        # still daylight to act on it — the egg question is an evening one.
        register_ping(PingSpec(
            ping_type='chicken_chore',
            module='chickens',
            build_message=build_chore_ping,
            default_send_at=dt_time(9, 0),
        ))

        # Parcours 14 Lot 6.4 — read-only agent tool for flock/laying stats.
        # Aggregates, not listable rows → dedicated tool (like weather's
        # get_weather). Declared here, never touching apps/agent/.
        from agent.tools import register as register_tool

        from .agent import build_get_chicken_stats_tool

        register_tool(build_get_chicken_stats_tool())


def _chicken_related(chicken):
    """A hen's recent journal entries — injected in the anchored assistant context."""
    return list(chicken.events.order_by('-occurred_on', '-created_at')[:10])


# --- writables: thin adapters mapping agent fields onto chickens.services -----


def _create_chicken_from_agent(household, user, fields, *, anchor=None):
    """Map the agent's raw ``fields`` to ``chickens.services.create_chicken``."""
    from .services import create_chicken

    zone_id = None
    if anchor:
        anchor_type, anchor_id = anchor
        if anchor_type == 'zone':
            zone_id = anchor_id

    return create_chicken(
        household,
        user,
        name=(fields.get('name') or '').strip(),
        breed=(fields.get('breed') or '').strip(),
        color=(fields.get('color') or '').strip(),
        hatched_on=fields.get('hatched_on'),
        acquired_on=fields.get('acquired_on'),
        status=fields.get('status'),
        notes=fields.get('notes') or '',
        zone_id=zone_id,
    )


def _update_chicken_from_agent(household, user, instance, fields):
    """Map the agent's raw ``fields`` to ``chickens.services.update_chicken``."""
    from .services import update_chicken

    return update_chicken(household, user, instance, fields=fields)


def _resolve_chicken_for_agent(household, raw_id):
    """Household-scoped chicken lookup for ``update_entity``."""
    from .models import Chicken

    return Chicken.objects.filter(household_id=household.id, pk=raw_id).first()


def _delete_chicken_from_agent(household, user, object_id):
    """Undo a created hen — hard delete, mirroring the REST DELETE."""
    from .services import delete_chicken

    chicken = _resolve_chicken_for_agent(household, object_id)
    if chicken is None:
        raise LookupError(f"no chicken {object_id} in this household")
    delete_chicken(household, user, chicken)


def _create_egg_log_from_agent(household, user, fields, *, anchor=None):
    """Upsert the daily egg count — 'j'ai ramassé 4 œufs' → today's log.

    Same service as the REST endpoint, so re-telling the agent the same day
    replaces the count instead of duplicating the row.
    """
    from django.utils import timezone

    from .services import log_eggs

    count = fields.get('count')
    if count in (None, ''):
        raise ValueError("egg_log needs a 'count' (number of eggs collected)")
    log, _created = log_eggs(
        household,
        user,
        date=fields.get('date') or timezone.localdate(),
        count=count,
        note=fields.get('note') or '',
    )
    return log


def _create_chore_from_agent(household, user, fields, *, anchor=None):
    """Map the agent's raw ``fields`` to ``chickens.services.create_chore``."""
    from .services import create_chore

    interval = fields.get('interval_days')
    if interval in (None, ''):
        raise ValueError(
            "chicken_chore needs an 'interval_days' (how many days between two times)"
        )
    return create_chore(
        household,
        user,
        name=(fields.get('name') or '').strip(),
        interval_days=interval,
        emoji=(fields.get('emoji') or '').strip(),
        starts_on=fields.get('starts_on'),
        notes=fields.get('notes') or '',
    )


def _update_chore_from_agent(household, user, instance, fields):
    from .services import update_chore

    return update_chore(household, user, instance, fields=fields)


def _resolve_chore_for_agent(household, raw_id):
    from .models import ChickenChore

    return ChickenChore.objects.filter(household_id=household.id, pk=raw_id).first()


def _delete_chore_from_agent(household, user, object_id):
    from .services import delete_chore

    chore = _resolve_chore_for_agent(household, object_id)
    if chore is None:
        raise LookupError(f"no chicken chore {object_id} in this household")
    delete_chore(household, user, chore)


def _complete_chore_from_agent(household, user, fields, *, anchor=None):
    """« J'ai nettoyé le poulailler » → the journal entry that resets the cadence.

    ``chore`` accepts an id or a name, because the user says the name out loud
    and never the uuid. An ambiguous name is refused rather than guessed: two
    chores called "nettoyage" would otherwise reset the wrong one, silently.
    """
    from .models import ChickenChore
    from .services import complete_chore

    raw = (str(fields.get('chore') or '')).strip()
    if not raw:
        raise ValueError("chicken_chore_done needs a 'chore' (its name or id)")

    chore = _resolve_chore_for_agent(household, raw) if _looks_like_uuid(raw) else None
    if chore is None:
        matches = list(
            ChickenChore.objects.filter(
                household_id=household.id, is_active=True, name__iexact=raw
            )
        ) or list(
            ChickenChore.objects.filter(
                household_id=household.id, is_active=True, name__icontains=raw
            )[:5]
        )
        if not matches:
            raise ValueError(f"no coop chore matching {raw!r} in this household")
        if len(matches) > 1:
            names = ', '.join(c.name for c in matches)
            raise ValueError(f"{raw!r} matches several chores ({names}) — be more specific")
        chore = matches[0]

    return complete_chore(
        household,
        user,
        chore,
        occurred_on=fields.get('occurred_on'),
        notes=fields.get('notes') or '',
    )


def _looks_like_uuid(raw: str) -> bool:
    from uuid import UUID

    try:
        UUID(raw)
    except (ValueError, AttributeError, TypeError):
        return False
    return True


def _resolve_completion_for_agent(household, raw_id):
    from .models import ChickenEvent

    return ChickenEvent.objects.filter(
        household_id=household.id, pk=raw_id, chore__isnull=False
    ).first()


def _delete_completion_from_agent(household, user, object_id):
    """Undo a "done" — removes the journal entry; the due date rolls back by itself."""
    from .services import delete_event

    event = _resolve_completion_for_agent(household, object_id)
    if event is None:
        raise LookupError(f"no chore completion {object_id} in this household")
    delete_event(household, user, event)


def _resolve_egg_log_for_agent(household, raw_id):
    from .models import EggLog

    return EggLog.objects.filter(household_id=household.id, pk=raw_id).first()


def _delete_egg_log_from_agent(household, user, object_id):
    """Undo a created egg log — hard delete of the day's row."""
    from .services import delete_egg_log

    log = _resolve_egg_log_for_agent(household, object_id)
    if log is None:
        raise LookupError(f"no egg log {object_id} in this household")
    delete_egg_log(household, user, log)


# --- list_entities filters -----------------------------------------------------

_CHICKEN_STATUSES = {'active', 'broody', 'sick', 'deceased', 'gone'}


def _filter_chicken_status(qs, value):
    statuses = [v.strip() for v in value.split(',') if v.strip()]
    unknown = [v for v in statuses if v not in _CHICKEN_STATUSES]
    if not statuses or unknown:
        raise ValueError(f"unknown status: {', '.join(unknown) or '(empty)'}")
    return qs.filter(status__in=statuses)


def _filter_in_flock(qs, value):
    from .models import Chicken

    if value.strip().lower() not in ('true', '1', 'yes'):
        return qs
    return qs.filter(status__in=Chicken.FLOCK_STATUSES)


def _filter_date_from(qs, value):
    return qs.filter(date__gte=_parse_date(value))


def _filter_date_to(qs, value):
    return qs.filter(date__lte=_parse_date(value))


def _parse_date(value):
    from datetime import date

    return date.fromisoformat(value.strip())


def _filter_chore_due(qs, value):
    """Only chores whose due date has passed.

    Evaluated through ``services.chore_status`` rather than rebuilt in SQL, on
    purpose: this is the same function the reminder and the dashboard alert
    read. "Quelles corvées sont en retard ?" and the notification must never be
    able to disagree — a second definition of *en retard* is the two-voices bug
    the money module already paid for. The table holds a handful of rows per
    household, so the cost is a rounding error.
    """
    from core.timezones import household_today

    from .services import chore_status

    if value.strip().lower() not in ('true', '1', 'yes'):
        return qs

    rows = qs.annotate(last_done_on=Max('completions__occurred_on')).select_related('household')
    due_ids = [
        chore.pk
        for chore in rows
        if chore_status(
            chore, today=household_today(chore.household), last_done_on=chore.last_done_on
        )['is_due']
    ]
    return qs.filter(pk__in=due_ids)


def _filter_chore_active(qs, value):
    if value.strip().lower() in ('false', '0', 'no'):
        return qs
    return qs.filter(is_active=True)


def _describe_chore(chore) -> str:
    from core.timezones import household_today

    from .services import chore_status

    last_done_on = getattr(chore, 'last_done_on', None)
    if last_done_on is None:
        from django.db.models import Max as _Max

        last_done_on = chore.completions.aggregate(last=_Max('occurred_on'))['last']

    state = chore_status(chore, today=household_today(chore.household), last_done_on=last_done_on)
    parts = [f"every {chore.interval_days} days"]
    if state['never_done']:
        parts.append("never done")
    else:
        parts.append(f"last done {state['last_done_on'].isoformat()}")
    parts.append(f"next due {state['next_due_on'].isoformat()}")
    if state['days_overdue']:
        parts.append(f"{state['days_overdue']} days late")
    if not chore.is_active:
        parts.append("paused")
    return ' | '.join(parts)


def _describe_chicken(chicken) -> str:
    parts = [chicken.status]
    if chicken.breed:
        parts.append(chicken.breed)
    if chicken.acquired_on:
        parts.append(f"since {chicken.acquired_on.isoformat()}")
    return ' | '.join(parts)


def _describe_egg_log(log) -> str:
    parts = [f"{log.count} eggs on {log.date.isoformat()}"]
    if log.note:
        parts.append(log.note)
    return ' | '.join(parts)
