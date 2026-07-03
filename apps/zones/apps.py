from django.apps import AppConfig


def _zone_related(zone):
    """Every household item linked to a zone, for the `get_related` agent tool.

    Gathers the zone's sub-zones, equipment, tasks, interactions and photo
    documents. Each instance is turned into a citable Hit through its own
    registered spec (unregistered types are skipped by the tool).
    """
    items = []
    items.extend(zone.children.all())
    items.extend(zone.equipment.all())
    items.extend(zone.tasks.all())
    items.extend(zone.interactions.all())
    items.extend(
        zd.document for zd in zone.zonedocument_set.select_related('document')
    )
    return items


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
            related=_zone_related,
        ))
