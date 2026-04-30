from django.apps import AppConfig


class EquipmentConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "equipment"

    def ready(self):
        from agent.searchables import SearchableSpec, register
        from .models import Equipment

        register(SearchableSpec(
            entity_type='equipment',
            model=Equipment,
            search_fields=('name', 'manufacturer', 'model', 'notes'),
            label_attr='name',
            url_template='/app/equipment/{id}',
        ))
