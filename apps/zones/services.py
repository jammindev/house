"""
Zones services — le point d'entrée métier des écritures d'ordre, et la
résolution d'une pièce désignée par son nom.

Le viewset REST **et** tout futur câblage agent passent par ces fonctions : c'est
ici que vit l'invariant « les rangs d'une fratrie sont 0..n-1, sans trou ni
doublon ». Un appelant qui écrirait `position` directement le violerait, et deux
frères au même rang rendraient l'ordre dépendant du plan d'exécution PostgreSQL.

C'est aussi ici que vit `resolve_zone` : une pièce se désigne par **son nom**, et
un seul endroit décide ce que « la chambre » veut dire.
"""
import unicodedata
import uuid

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


# --- Résoudre « la chambre » ---------------------------------------------------
#
# Un utilisateur nomme une pièce, il ne cite jamais un UUID. Le tool
# `create_entity` de l'agent offre déjà ce « nom ou id » pour un tracker, un
# compteur ou un article de stock ; les zones en manquaient, et une note demandée
# « dans la salle de bain » atterrissait donc sans zone du tout (#579).
#
# Deux principes portent tout ce bloc :
#   - le foyer borne la résolution — c'est ici que se refuse l'écriture dans la
#     pièce d'un autre foyer, pas dans l'appelant ;
#   - l'ambigu se dit, il ne se devine pas (`banking.rules` : « des valeurs de
#     départ, jamais des vérités »). Choisir au hasard entre deux chambres rangerait
#     la note dans la mauvaise pièce en confirmant à l'utilisateur que c'est fait.


def _fold(text) -> str:
    """Minuscule sans accents, pour comparer ce qu'un humain écrit.

    « salle de bain » doit retrouver « Salle de bain » : la casse et les accents
    ne sont pas des différences de désignation.
    """
    decomposed = unicodedata.normalize('NFKD', str(text or ''))
    stripped = ''.join(c for c in decomposed if not unicodedata.combining(c))
    return stripped.casefold().strip()


def _only_one(candidates, raw) -> Zone:
    """La seule candidate, ou un `ValueError` qui les nomme toutes."""
    if len(candidates) == 1:
        return candidates[0]
    listed = ', '.join(f"{zone.name} ({zone.id})" for zone in candidates)
    raise ValueError(
        f"ambiguous zone '{raw}' — several zones match, pass an id: {listed}"
    )


def resolve_zone(household, value) -> Zone:
    """Résout une zone depuis une référence brute : un id, ou un nom.

    Args:
        household: instance de foyer (ou son id) — borne la recherche.
        value: un UUID, un nom (« Salle de bain »), ou la tournure de
            l'utilisateur (« dans la salle de bain »).

    Raises:
        ValueError: référence vide, inconnue, ou ambiguë. C'est le contrat
            d'erreur **récupérable** des writables de l'agent : le tool le
            transforme en message que le modèle relaie, au lieu d'écrire une
            entrée rangée nulle part.
    """
    household_id = getattr(household, 'id', household)
    raw = str(getattr(value, 'pk', value) or '').strip()
    if not raw:
        raise ValueError("zone is required")

    try:
        zone_uuid = uuid.UUID(raw)
    except ValueError:
        zone_uuid = None
    if zone_uuid is not None:
        # Un id est une désignation exacte : introuvable veut dire « pas dans ce
        # foyer », jamais « c'est peut-être un nom » — sinon l'id d'une pièce
        # d'un autre foyer se ferait deviner comme un libellé.
        match = Zone.objects.filter(household_id=household_id, pk=zone_uuid).first()
        if match is None:
            raise ValueError(f"unknown zone: {raw}")
        return match

    needle = _fold(raw)
    # Un foyer compte quelques dizaines de pièces : une seule requête, puis la
    # comparaison en Python, qui sait faire ce qu'`icontains` ne fait pas (les
    # accents, et la containment dans l'autre sens).
    zones = list(Zone.objects.filter(household_id=household_id))

    exact = [zone for zone in zones if _fold(zone.name) == needle]
    if exact:
        return _only_one(exact, raw)

    # « dans la salle de bain » : c'est le NOM qui est contenu dans ce que
    # l'utilisateur a dit. Le plus long gagne — « Salle de bain » avant « Salle » :
    # pas une devinette, le nom le plus précis qui tienne encore dans la phrase.
    inside_phrase = [
        zone for zone in zones if _fold(zone.name) and _fold(zone.name) in needle
    ]
    if inside_phrase:
        longest = max(len(_fold(zone.name)) for zone in inside_phrase)
        return _only_one(
            [zone for zone in inside_phrase if len(_fold(zone.name)) == longest], raw
        )

    # « chambre » pour « Chambre parentale » : là le mot ne discrimine rien, donc
    # deux candidates restent deux candidates.
    partial = [zone for zone in zones if needle in _fold(zone.name)]
    if partial:
        return _only_one(partial, raw)

    raise ValueError(f"unknown zone: {raw}")


def resolve_zone_ids(household, *refs) -> list[str]:
    """Résout plusieurs références de zone en ids, dédoublonnés, ordre préservé.

    Accepte indifféremment des valeurs seules et des listes (`zone` et
    `zone_ids` côté agent), et ignore les vides — un champ absent n'est pas une
    demande de zone.
    """
    resolved: list[str] = []
    for ref in refs:
        values = ref if isinstance(ref, (list, tuple, set)) else [ref]
        for value in values:
            if value in (None, ''):
                continue
            zone_id = str(resolve_zone(household, value).id)
            if zone_id not in resolved:
                resolved.append(zone_id)
    return resolved
