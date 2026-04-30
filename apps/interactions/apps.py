from django.apps import AppConfig


class InteractionsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'interactions'

    def ready(self):
        from agent.searchables import SearchableSpec, register
        from .models import Interaction

        register(SearchableSpec(
            entity_type='interaction',
            model=Interaction,
            search_fields=('subject', 'content'),
            label_attr='subject',
            url_template='/app/interactions/{id}',
        ))
