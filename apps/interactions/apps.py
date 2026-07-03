from django.apps import AppConfig


class InteractionsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'interactions'

    def ready(self):
        from agent.listables import ListableSpec, ListFilter, register as register_listable
        from agent.searchables import SearchableSpec, register
        from agent.writables import WritableSpec, register as register_writable
        from .models import Interaction

        register(SearchableSpec(
            entity_type='interaction',
            model=Interaction,
            search_fields=('subject', 'content'),
            label_attr='subject',
            url_template='/app/interactions/{id}',
        ))

        register_writable(WritableSpec(
            entity_type='note',
            create=_create_note_from_agent,
            update=_update_note_from_agent,
            updatable_fields=('subject', 'content'),
            resolve=_resolve_note_for_agent,
            label_attr='subject',
            url_template='/app/interactions/{id}',
        ))

        register_listable(ListableSpec(
            entity_type='interaction',
            model=Interaction,
            filters=(
                ListFilter('type', 'comma-separated interaction types', _filter_type),
                ListFilter('occurred_after', 'occurred_at >= YYYY-MM-DD', _filter_occurred_after),
                ListFilter('occurred_before', 'occurred_at <= YYYY-MM-DD', _filter_occurred_before),
            ),
            order_by=('-occurred_at', '-created_at'),
            describe=_describe_interaction,
            amount_of=_interaction_amount,
        ))


def _create_note_from_agent(household, user, fields, *, anchor=None):
    """Map the agent's raw ``fields`` to ``interactions.services.create_note_interaction``.

    Resolves the conversation ``anchor``: an anchored project links the note to
    that project (it lands in the project's timeline); an anchored zone attaches
    the note to that zone.
    """
    from .services import create_note_interaction

    project = None
    zone_ids = None
    if anchor:
        anchor_type, anchor_id = anchor
        if anchor_type == 'project':
            project = anchor_id
        elif anchor_type == 'zone':
            zone_ids = [anchor_id]

    return create_note_interaction(
        household=household,
        user=user,
        subject=(fields.get('subject') or '').strip(),
        content=fields.get('content') or '',
        project=project,
        zone_ids=zone_ids,
    )


def _update_note_from_agent(household, user, instance, fields):
    """Map the agent's raw ``fields`` to ``interactions.services.update_note_interaction``."""
    from .services import update_note_interaction

    return update_note_interaction(
        household=household, user=user, interaction=instance, fields=fields
    )


def _resolve_note_for_agent(household, raw_id):
    """Household-scoped NOTE lookup for ``update_entity``.

    The writable type 'note' is an Interaction restricted to type='note'; other
    interaction types (expenses, maintenances…) are not agent-editable. The
    private-note-of-another-user case is rejected by the service (it knows the
    acting user).
    """
    from .models import Interaction

    return Interaction.objects.filter(
        household_id=household.id, pk=raw_id, type='note'
    ).first()


# --- list_entities filters ---------------------------------------------------

_INTERACTION_TYPES = {
    'note', 'todo', 'expense', 'maintenance', 'repair', 'installation',
    'inspection', 'warranty', 'issue', 'upgrade', 'replacement', 'disposal',
}


def _filter_type(qs, value):
    types = [v.strip() for v in value.split(',') if v.strip()]
    unknown = [v for v in types if v not in _INTERACTION_TYPES]
    if not types or unknown:
        raise ValueError(f"unknown type: {', '.join(unknown) or '(empty)'}")
    return qs.filter(type__in=types)


def _filter_occurred_after(qs, value):
    return qs.filter(occurred_at__date__gte=_parse_date(value))


def _filter_occurred_before(qs, value):
    return qs.filter(occurred_at__date__lte=_parse_date(value))


def _parse_date(value):
    from datetime import date

    return date.fromisoformat(value.strip())


def _describe_interaction(interaction) -> str:
    parts = [interaction.type]
    if interaction.occurred_at:
        parts.append(interaction.occurred_at.date().isoformat())
    metadata = interaction.metadata or {}
    if metadata.get('amount'):
        parts.append(f"amount {metadata['amount']}")
    if metadata.get('supplier'):
        parts.append(str(metadata['supplier']))
    return ' | '.join(parts)


def _interaction_amount(interaction):
    """Decimal amount of an interaction (expenses), or None."""
    from decimal import Decimal, InvalidOperation

    raw = (interaction.metadata or {}).get('amount')
    if raw in (None, ''):
        return None
    try:
        return Decimal(str(raw))
    except InvalidOperation:
        return None
