# water/apps.py
from django.apps import AppConfig


class WaterConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "water"

    def ready(self):
        from agent.listables import ListableSpec, ListFilter, register as register_listable
        from agent.writables import WritableSpec, register as register_writable

        from .models import WaterReading

        register_writable(WritableSpec(
            entity_type='water_reading',
            create=_create_reading_from_agent,
            update=_update_reading_from_agent,
            updatable_fields=('reading_date', 'index_m3'),
            resolve=_resolve_reading_for_agent,
            label_attr=_reading_label,
            url_template='/app/water?reading={id}',
        ))

        register_listable(ListableSpec(
            entity_type='water_reading',
            model=WaterReading,
            filters=(
                ListFilter('date_from', 'reading date >= YYYY-MM-DD', _filter_date_from),
                ListFilter('date_to', 'reading date <= YYYY-MM-DD', _filter_date_to),
            ),
            order_by=('-reading_date',),
            describe=_describe_reading,
        ))


# --- create/update handlers (thin adapters over water.services) ---------------


def _create_reading_from_agent(household, user, fields, *, anchor=None):
    """Map the agent's raw ``fields`` to ``water.services.create_water_reading``.

    Same write path as the REST viewset: ``WaterReadingSerializer`` validation
    (index monotonicity, one reading per day).
    """
    from django.utils import timezone

    from .services import create_water_reading

    index_m3 = fields.get('index_m3')
    if index_m3 in (None, ''):
        raise ValueError("index_m3 is required")

    return create_water_reading(
        household,
        user,
        reading_date=_parse_date(fields.get('reading_date')) or timezone.localdate(),
        index_m3=str(index_m3).strip().replace(',', '.'),
    )


def _update_reading_from_agent(household, user, instance, fields):
    from .services import update_water_reading

    payload = dict(fields)
    if payload.get('index_m3') not in (None, ''):
        payload['index_m3'] = str(payload['index_m3']).strip().replace(',', '.')
    if 'reading_date' in payload:
        payload['reading_date'] = _parse_date(payload['reading_date'])
    return update_water_reading(household, user, instance, fields=payload)


def _resolve_reading_for_agent(household, raw_id):
    from .models import WaterReading

    return WaterReading.objects.filter(household_id=household.id, pk=raw_id).first()


def _reading_label(reading) -> str:
    return f"{reading.reading_date:%Y-%m-%d} — {reading.index_m3:g} m³"


def _parse_date(value):
    """Parse an ISO date string; None/blank passes through (= today)."""
    if value in (None, ''):
        return None
    from datetime import date

    try:
        return date.fromisoformat(str(value).strip())
    except ValueError as exc:
        raise ValueError(f"invalid date: {value}") from exc


# --- list_entities filters -----------------------------------------------------


def _filter_date_from(qs, value):
    from datetime import date

    return qs.filter(reading_date__gte=date.fromisoformat(value.strip()))


def _filter_date_to(qs, value):
    from datetime import date

    return qs.filter(reading_date__lte=date.fromisoformat(value.strip()))


def _describe_reading(reading) -> str:
    return f"{reading.reading_date:%Y-%m-%d} | index {reading.index_m3:g} m³"
