from django.apps import AppConfig


class ChickensConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'chickens'

    def ready(self):
        from agent.listables import ListableSpec, ListFilter, register as register_listable
        from agent.searchables import SearchableSpec, register
        from agent.writables import WritableSpec, register as register_writable
        from .models import Chicken, ChickenEvent, EggLog

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
        from .pings import build_egg_ping

        register_ping(PingSpec(
            ping_type='egg_log',
            module='chickens',
            build_message=build_egg_ping,
            default_send_at=dt_time(19, 0),
        ))


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
