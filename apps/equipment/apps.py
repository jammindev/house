from django.apps import AppConfig


def _equipment_related(equipment):
    """Every household item linked to an equipment, for the `get_related` agent tool.

    Gathers the equipment's zone and its interaction history (purchases,
    maintenances, repairs…). Each instance is turned into a citable Hit through
    its own registered spec.
    """
    items = []
    if equipment.zone_id:
        items.append(equipment.zone)
    items.extend(
        ei.interaction
        for ei in equipment.equipment_interactions.select_related('interaction')
    )
    return items


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
            related=_equipment_related,
        ))
