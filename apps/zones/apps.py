from django.apps import AppConfig


class ZonesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'zones'

    def ready(self):
        from agent.searchables import SearchableSpec, register
        from .models import Zone

        register(SearchableSpec(
            entity_type='zone',
            model=Zone,
            search_fields=('name', 'note'),
            label_attr='name',
            url_template='/app/zones/{id}',
        ))
