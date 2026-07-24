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
            delete=_delete_note_from_agent,
            label_attr='subject',
            url_template='/app/interactions/{id}',
        ))

        register_writable(WritableSpec(
            entity_type='renovation',
            create=_create_renovation_from_agent,
            resolve=_resolve_renovation_for_agent,
            delete=_delete_renovation_from_agent,
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


def _delete_note_from_agent(household, user, object_id):
    """Undo a created note — hard-delete it, via ``delete_note_interaction``.

    Raises ``LookupError`` when the note is already gone so a double undo is a
    no-op rather than an error.
    """
    from .services import delete_note_interaction

    note = _resolve_note_for_agent(household, object_id)
    if note is None:
        raise LookupError(f"no note {object_id} in this household")
    delete_note_interaction(household=household, user=user, interaction=note)


# --- renovation writable (parcours 13) ---------------------------------------
#
# Agent can CREATE renovation log entries and UNDO (delete) them. Edits stay on
# the UI/REST side: the structured fields live in ``metadata`` and the agent's
# update-undo snapshot reads model attributes only, so agent-side update is out
# of scope here by design.

def _create_renovation_from_agent(household, user, fields, *, anchor=None):
    """Map the agent's raw ``fields`` to ``services.create_renovation_interaction``.

    An anchored zone conversation attaches the entry to that zone; otherwise the
    agent must pass ``zone_ids`` (the service rejects a zone-less entry).
    """
    from .services import create_renovation_interaction

    zone_ids = list(fields.get('zone_ids') or [])
    if anchor:
        anchor_type, anchor_id = anchor
        if anchor_type == 'zone' and anchor_id not in zone_ids:
            zone_ids.append(anchor_id)

    return create_renovation_interaction(
        household=household,
        user=user,
        element=(fields.get('element') or 'other'),
        product=fields.get('product') or '',
        brand=fields.get('brand') or '',
        reference=fields.get('reference') or '',
        interaction_type=fields.get('interaction_type') or 'installation',
        subject=(fields.get('subject') or None),
        notes=fields.get('notes') or fields.get('content') or '',
        zone_ids=zone_ids,
    )


def _resolve_renovation_for_agent(household, raw_id):
    """Household-scoped renovation-entry lookup (metadata.kind='renovation')."""
    from .models import Interaction

    return Interaction.objects.filter(
        household_id=household.id, pk=raw_id, metadata__kind='renovation'
    ).first()


def _delete_renovation_from_agent(household, user, object_id):
    """Undo a created renovation entry — hard-delete via the shared service."""
    from .services import delete_renovation_interaction

    entry = _resolve_renovation_for_agent(household, object_id)
    if entry is None:
        raise LookupError(f"no renovation entry {object_id} in this household")
    delete_renovation_interaction(household=household, user=user, interaction=entry)


# --- list_entities filters ---------------------------------------------------

_INTERACTION_TYPES = {
    'note', 'expense', 'maintenance', 'repair', 'installation',
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
    if interaction.amount is not None:
        parts.append(f"amount {interaction.amount}")
    if interaction.supplier:
        parts.append(interaction.supplier)
    return ' | '.join(parts)


def _interaction_amount(interaction):
    """Decimal amount of an interaction (expenses), or None."""
    return interaction.amount
