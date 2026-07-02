from django.apps import AppConfig


class TasksConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tasks'

    def ready(self):
        from agent.searchables import SearchableSpec, register
        from agent.writables import WritableSpec, register as register_writable
        from .models import Task

        register(SearchableSpec(
            entity_type='task',
            model=Task,
            search_fields=('subject', 'content'),
            label_attr='subject',
            url_template='/app/tasks/{id}',
        ))

        register_writable(WritableSpec(
            entity_type='task',
            create=_create_task_from_agent,
            label_attr='subject',
            url_template='/app/tasks/{id}',
        ))


def _create_task_from_agent(household, user, fields, *, anchor=None):
    """Map the agent's raw ``fields`` to ``tasks.services.create_task``.

    Resolves the conversation ``anchor`` into a sensible default link: an
    anchored project pre-fills the task's project (and its zones are inherited by
    the task serializer via the project); an anchored zone pre-fills the zone.
    """
    from .services import create_task

    project = None
    zone_ids = None
    if anchor:
        anchor_type, anchor_id = anchor
        if anchor_type == 'project':
            project = anchor_id
        elif anchor_type == 'zone':
            zone_ids = [anchor_id]

    priority = fields.get('priority')
    return create_task(
        household,
        user,
        subject=(fields.get('subject') or '').strip(),
        content=fields.get('content'),
        due_date=fields.get('due_date'),
        priority=int(priority) if priority not in (None, '') else None,
        project=project,
        zone_ids=zone_ids,
    )
