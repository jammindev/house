"""
Zones read helpers — les compteurs de contenu d'une zone.

La liste des zones est une **arborescence dense** : chaque ligne doit dire, sans
clic, si la zone est vivante (des équipements, des tâches ouvertes, un chantier)
ou vide. Ces compteurs sont donc servis par l'endpoint liste, jamais calculés
côté client.

Deux règles à préserver :

- **Un compteur passe par `Subquery`, jamais par `Count` multiple.** Quatre
  `Count` sur quatre relations inverses dans la même requête produisent un
  produit cartésien : `distinct=True` rétablit la justesse mais fait exploser le
  coût. Chaque sous-requête ici est corrélée et tape un index existant
  (`idx_equipment_zone`, `task_zones.zone_id`, `project_zones.zone_id`,
  `zones.parent_id`).
- **Un compteur de la liste dit la même chose que l'onglet du détail.** Le
  périmètre de chaque compteur est calqué sur le hook front correspondant
  (`useEquipmentByZone`, `useZoneTasks`, `useZoneProjects`) : deux chiffres
  différents pour la même zone dans deux écrans font perdre leur crédit aux deux.
"""
from django.db.models import Count, IntegerField, OuterRef, Subquery


#: Statuts de tâche qui ne comptent pas comme « ouverte » — miroir de
#: ``useZoneTasks`` côté front.
CLOSED_TASK_STATUSES = ('done', 'archived')


def _count_subquery(queryset, *, field='zone'):
    """Sous-requête corrélée renvoyant un COUNT(*) pour la zone courante."""
    return Subquery(
        queryset.filter(**{field: OuterRef('pk')})
        .order_by()
        .values(field)
        .annotate(n=Count('pk'))
        .values('n')[:1],
        output_field=IntegerField(),
    )


def with_content_counts(queryset):
    """Annote un queryset de zones avec ses compteurs de contenu.

    Ajoute ``children_count``, ``equipment_count``, ``open_task_count`` et
    ``active_project_count``. Les sous-requêtes renvoient ``NULL`` quand la zone
    n'a rien : le serializer normalise en 0 (``Coalesce`` en SQL coûterait un
    ``CASE`` de plus par ligne pour le même résultat).
    """
    from equipment.models import Equipment
    from projects.models import ProjectZone
    from tasks.models import TaskZone

    from .models import Zone

    return queryset.annotate(
        children_count=_count_subquery(Zone.objects.all(), field='parent'),
        equipment_count=_count_subquery(Equipment.objects.all()),
        open_task_count=_count_subquery(
            TaskZone.objects.exclude(task__status__in=CLOSED_TASK_STATUSES)
        ),
        active_project_count=_count_subquery(
            ProjectZone.objects.filter(project__status='active')
        ),
    )
