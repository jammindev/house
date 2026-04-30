from django.apps import AppConfig


class TasksConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tasks'

    def ready(self):
        from agent.searchables import SearchableSpec, register
        from .models import Task

        register(SearchableSpec(
            entity_type='task',
            model=Task,
            search_fields=('subject', 'content'),
            label_attr='subject',
            url_template='/app/tasks/{id}',
        ))
