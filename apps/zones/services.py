"""
Zones services — le point d'entrée métier des écritures d'ordre.

Le viewset REST **et** tout futur câblage agent passent par ces fonctions : c'est
ici que vit l'invariant « les rangs d'une fratrie sont 0..n-1, sans trou ni
doublon ». Un appelant qui écrirait `position` directement le violerait, et deux
frères au même rang rendraient l'ordre dépendant du plan d'exécution PostgreSQL.
"""
from django.db import transaction
from django.db.models import F

from .models import Zone


def _siblings(household_id, parent_id):
    """La fratrie d'un parent donné, dans son ordre courant."""
    return Zone.objects.filter(household_id=household_id, parent_id=parent_id).order_by(
        'position', 'name'
    )


@transaction.atomic
def normalize_positions(household_id, parent_id) -> list[Zone]:
    """Réécrit les rangs d'une fratrie en 0..n-1 selon son ordre courant.

    Idempotent, et volontairement appelé après toute opération susceptible de
    laisser un trou (suppression, changement de parent).
    """
    siblings = list(_siblings(household_id, parent_id))
    to_update = []
    for index, zone in enumerate(siblings):
        if zone.position != index:
            zone.position = index
            to_update.append(zone)
    if to_update:
        Zone.objects.bulk_update(to_update, ['position'])
    return siblings


@transaction.atomic
def reorder_siblings(household, parent_id, zone_ids) -> list[Zone]:
    """Applique un ordre explicite à une fratrie (glisser-déposer).

    `zone_ids` doit être exactement la fratrie de `parent_id` — ni plus, ni
    moins. On refuse un sous-ensemble plutôt que de le compléter : un client qui
    n'envoie qu'une partie de la fratrie travaille sur une vue périmée, et
    « compléter » son intention produirait un ordre que personne n'a demandé.

    Raises:
        ValueError: si les ids ne correspondent pas exactement à la fratrie.
    """
    siblings = {str(zone.id): zone for zone in _siblings(household.id, parent_id)}
    requested = [str(zone_id) for zone_id in zone_ids]

    if len(requested) != len(set(requested)):
        raise ValueError("Duplicate zone ids in the requested order.")

    if set(requested) != set(siblings):
        missing = sorted(set(siblings) - set(requested))
        unknown = sorted(set(requested) - set(siblings))
        raise ValueError(
            "The requested order must list the whole sibling group. "
            f"Missing: {missing or 'none'}. Not siblings: {unknown or 'none'}."
        )

    for index, zone_id in enumerate(requested):
        siblings[zone_id].position = index
    Zone.objects.bulk_update(siblings.values(), ['position'])

    return [siblings[zone_id] for zone_id in requested]


@transaction.atomic
def move_zone(zone, direction) -> bool:
    """Décale une zone d'un rang parmi ses frères. Retourne False si déjà au bord.

    Un no-op au bord n'est pas une erreur : le bouton reste cliquable et
    l'utilisateur n'a pas à deviner s'il est en butée.

    Raises:
        ValueError: si `direction` n'est ni 'up' ni 'down'.
    """
    if direction not in ('up', 'down'):
        raise ValueError("direction must be 'up' or 'down'.")

    # Normaliser d'abord : sur des données héritées (tous les rangs à 0), un
    # échange de rangs entre deux zones ne déplacerait rien.
    siblings = normalize_positions(zone.household_id, zone.parent_id)
    ids = [str(sibling.id) for sibling in siblings]
    try:
        index = ids.index(str(zone.id))
    except ValueError:  # pragma: no cover - la zone appartient à sa fratrie
        return False

    target = index - 1 if direction == 'up' else index + 1
    if target < 0 or target >= len(ids):
        return False

    ids[index], ids[target] = ids[target], ids[index]
    reorder_siblings(zone.household, zone.parent_id, ids)
    return True


@transaction.atomic
def place_at_end(zone) -> None:
    """Donne à une zone le dernier rang de sa (nouvelle) fratrie.

    Appelé à la création et après un changement de parent : une zone qui arrive
    dans une fratrie n'a pas de rang, et laisser le défaut `0` la ferait
    apparaître en tête, devant des zones rangées de longue date.
    """
    last = (
        Zone.objects.filter(household_id=zone.household_id, parent_id=zone.parent_id)
        .exclude(pk=zone.pk)
        .order_by('-position')
        .values_list('position', flat=True)
        .first()
    )
    position = 0 if last is None else last + 1
    if zone.position != position:
        zone.position = position
        Zone.objects.filter(pk=zone.pk).update(position=position)


def shift_positions_after_removal(household_id, parent_id, removed_position) -> None:
    """Referme le trou laissé par une suppression, sans relire la fratrie."""
    Zone.objects.filter(
        household_id=household_id,
        parent_id=parent_id,
        position__gt=removed_position,
    ).update(position=F('position') - 1)
