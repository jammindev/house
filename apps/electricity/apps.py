# electricity/apps.py
from django.apps import AppConfig


class ElectricityConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "electricity"

    def ready(self):
        from agent.listables import ListableSpec, ListFilter, register as register_listable
        from agent.searchables import SearchableSpec, register
        from agent.writables import WritableSpec, register as register_writable

        from .models import ConsumptionRecord, ElectricityMeter, MeterReading

        register(SearchableSpec(
            entity_type='meter',
            module='electricity',
            model=ElectricityMeter,
            search_fields=('name', 'serial_number', 'notes'),
            label_attr='name',
            url_template='/app/electricity?meter={id}',
        ))

        register_writable(WritableSpec(
            entity_type='meter_reading',
            module='electricity',
            create=_create_reading_from_agent,
            label_attr=_reading_label,
            url_template='/app/electricity?reading={id}',
        ))

        register_listable(ListableSpec(
            entity_type='consumption',
            module='electricity',
            model=ConsumptionRecord,
            filters=(
                ListFilter('meter', 'meter name or id', _filter_meter),
                ListFilter('date_from', 'ts_start >= YYYY-MM-DD (UTC day boundary)', _filter_date_from),
                ListFilter('date_to', 'ts_start <= YYYY-MM-DD end of day (UTC)', _filter_date_to),
                ListFilter('register', 'comma-separated among base, hp, hc', _filter_register),
                ListFilter('source', "'reading' (estimates) or 'import' (measured)", _filter_source),
            ),
            order_by=('-ts_start',),
            describe=_describe_consumption,
            amount_of=_consumption_kwh,
        ))

        register_listable(ListableSpec(
            entity_type='meter_reading',
            module='electricity',
            model=MeterReading,
            filters=(
                ListFilter('meter', 'meter name or id', _filter_meter),
                ListFilter('register', 'comma-separated among base, hp, hc', _filter_register),
            ),
            order_by=('-reading_at',),
            describe=_describe_reading,
        ))


def _resolve_meter(household_id, raw):
    """Find a meter by id or name — household-scoped.

    When the household has a single meter, an empty value resolves to it, so
    the agent can record "j'ai relevé 45230" without naming the meter.
    """
    import uuid

    from .models import ElectricityMeter

    qs = ElectricityMeter.objects.filter(household_id=household_id)
    value = (str(raw) if raw is not None else '').strip()
    if not value:
        meters = list(qs[:2])
        if len(meters) == 1:
            return meters[0]
        raise ValueError(
            "meter is required (several meters exist)" if meters else "no meter declared"
        )
    try:
        match = qs.filter(pk=uuid.UUID(value)).first()
        if match is not None:
            return match
    except ValueError:
        pass
    match = qs.filter(name__iexact=value).first() or qs.filter(name__icontains=value).first()
    if match is None:
        raise ValueError(f"unknown meter: {value}")
    return match


def _create_reading_from_agent(household, user, fields, *, anchor=None):
    """Map the agent's raw ``fields`` to ``electricity.services.create_meter_reading``.

    Same write path as the REST viewset: serializer validation (register vs
    tariff, index monotonicity) + regeneration of the daily estimates.
    """
    from django.utils import timezone

    from .models import MeterTariffType
    from .services import create_meter_reading

    meter = _resolve_meter(household.id, fields.get('meter'))
    register = (fields.get('register') or '').strip().lower()
    if not register:
        if meter.tariff_type != MeterTariffType.BASE:
            raise ValueError("register is required for a peak/off-peak meter: 'hp' or 'hc'")
        register = 'base'

    return create_meter_reading(
        household,
        user,
        meter=meter,
        register=register,
        reading_at=fields.get('reading_at') or timezone.now(),
        index_kwh=fields.get('index_kwh'),
    )


def _reading_label(reading) -> str:
    return f"{reading.meter.name} — {reading.register} {reading.index_kwh} kWh"


# --- list_entities filters -----------------------------------------------------


def _filter_meter(qs, value):
    """The queryset is already household-scoped by the tool — narrow by meter."""
    import uuid

    value = value.strip()
    try:
        return qs.filter(meter_id=uuid.UUID(value))
    except ValueError:
        pass
    exact = qs.filter(meter__name__iexact=value)
    return exact if exact.exists() else qs.filter(meter__name__icontains=value)


def _filter_date_from(qs, value):
    return qs.filter(ts_start__gte=_parse_utc_day(value))


def _filter_date_to(qs, value):
    from datetime import timedelta

    return qs.filter(ts_start__lt=_parse_utc_day(value) + timedelta(days=1))


def _filter_register(qs, value):
    registers = [v.strip().lower() for v in value.split(',') if v.strip()]
    unknown = [v for v in registers if v not in ('base', 'hp', 'hc')]
    if not registers or unknown:
        raise ValueError(f"unknown register: {', '.join(unknown) or '(empty)'}")
    return qs.filter(register__in=registers)


def _filter_source(qs, value):
    source = value.strip().lower()
    if source not in ('reading', 'import'):
        raise ValueError("source must be 'reading' or 'import'")
    return qs.filter(source=source)


def _parse_utc_day(value):
    from datetime import date, datetime, time, timezone as dt_timezone

    parsed = date.fromisoformat(value.strip())
    return datetime.combine(parsed, time.min, tzinfo=dt_timezone.utc)


def _describe_consumption(record) -> str:
    kwh = record.energy_wh / 1000
    return (
        f"{record.ts_start:%Y-%m-%d %H:%M} | {record.interval_minutes} min | "
        f"{kwh:g} kWh | {record.register} | {record.source}"
    )


def _describe_reading(reading) -> str:
    return f"{reading.reading_at:%Y-%m-%d %H:%M} | {reading.register} | index {reading.index_kwh} kWh"


def _consumption_kwh(record):
    from decimal import Decimal

    return Decimal(record.energy_wh) / 1000
