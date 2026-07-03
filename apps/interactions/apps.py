from django.apps import AppConfig


class InteractionsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'interactions'

    def ready(self):
        from agent.searchables import SearchableSpec, register
        from agent.writables import WritableSpec, register as register_writable
        from .models import Interaction

        register(SearchableSpec(
            entity_type='interaction',
            model=Interaction,
            search_fields=('subject', 'content'),
            label_attr='subject',
            url_template='/app/interactions/{id}/edit',
        ))

        register_writable(WritableSpec(
            entity_type='note',
            create=_create_note_from_agent,
            label_attr='subject',
            url_template='/app/interactions/{id}/edit',
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
