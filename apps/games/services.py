"""Jeux du foyer — le point d'entrée métier des écritures (parcours 31, lot 2).

Le viewset REST **et** tout futur câblage agent passent par ces fonctions. C'est
ici que vivent les deux règles du jeu :

1. **une seule chasse active par foyer** (la base la tient aussi, ceinture et
   bretelles : deux parties lancées sur deux téléphones mélangeraient leurs
   étapes) ;
2. **le serveur seul décide si la pièce scannée est la bonne** — jamais le
   client. Un client qui trancherait pourrait être poussé à dire oui, et
   l'avancement se rejouerait différemment d'un appareil à l'autre.
"""
from __future__ import annotations

import random

from django.db import transaction
from django.utils import timezone

from .models import Hunt, HuntStep

#: Verdicts rendus par ``record_scan``. La vue les traduit en réponse HTTP ; le
#: front les rend en écran. Aucun autre endroit n'a le droit d'en inventer un.
VERDICT_NO_HUNT = 'no_hunt'
VERDICT_WRONG_ZONE = 'wrong_zone'
VERDICT_ALREADY_FOUND = 'already_found'
VERDICT_ADVANCED = 'advanced'
VERDICT_FINISHED = 'finished'


class HuntError(ValueError):
    """Refus métier — la vue le traduit en 400 nommé."""


def active_hunt(household) -> Hunt | None:
    """La chasse en cours du foyer, s'il y en a une."""
    return (
        Hunt.objects.filter(household=household, status=Hunt.Status.ACTIVE)
        .prefetch_related('steps__zone')
        .first()
    )


@transaction.atomic
def start_hunt(hunt: Hunt) -> Hunt:
    """Lance une chasse préparée."""
    if hunt.status != Hunt.Status.DRAFT:
        raise HuntError("Only a draft hunt can be started.")
    if not hunt.steps.exists():
        # Une chasse sans étape se terminerait à l'instant où elle commence, en
        # révélant le trésor sans que personne ait bougé.
        raise HuntError("A hunt needs at least one step before it can start.")
    running = (
        Hunt.objects.filter(household_id=hunt.household_id, status=Hunt.Status.ACTIVE)
        .exclude(pk=hunt.pk)
        .first()
    )
    if running is not None:
        raise HuntError(
            f"Another hunt is already running ({running.name}). Finish or abandon it first."
        )

    hunt.status = Hunt.Status.ACTIVE
    hunt.started_at = timezone.now()
    hunt.finished_at = None
    hunt.steps.update(found_at=None)
    hunt.save(update_fields=['status', 'started_at', 'finished_at', 'updated_at'])
    return hunt


@transaction.atomic
def abandon_hunt(hunt: Hunt) -> Hunt:
    """Arrête une chasse en cours sans la marquer terminée."""
    if hunt.status != Hunt.Status.ACTIVE:
        raise HuntError("Only a running hunt can be abandoned.")
    hunt.status = Hunt.Status.ABANDONED
    hunt.finished_at = timezone.now()
    hunt.save(update_fields=['status', 'finished_at', 'updated_at'])
    return hunt


@transaction.atomic
def replay_hunt(hunt: Hunt, *, created_by=None, rng: random.Random | None = None) -> Hunt:
    """Ressort une chasse jouée, dans un ordre mélangé — sans toucher l'originale.

    Trois choses comptent ici, et chacune répond à une façon de se tromper :

    1. **L'originale n'est jamais modifiée.** Un « rejouer » qui remettrait les
       `found_at` à zéro effacerait la partie de l'an dernier, et le foyer perdrait
       la seule trace qu'il a jouée. On crée une chasse neuve, en `draft`.
    2. **L'ordre diffère.** Rejouer à l'identique n'est pas rejouer : les enfants
       connaissent la suite, et le jeu est terminé au premier scan. Une chasse
       d'une seule étape ne peut évidemment pas être mélangée — on ne s'acharne
       pas, et on ne fait pas boucler l'algorithme pour rien.
    3. **Le brouillon reste modifiable.** C'est le point du lot : ressortir sans
       tout ressaisir, pas relancer aveuglément. Le parent peut corriger les
       énigmes avant de lancer.
    """
    steps = list(hunt.steps.all().order_by('position'))
    if not steps:
        raise HuntError("A hunt without steps cannot be replayed.")

    copy = Hunt.objects.create(
        household=hunt.household,
        name=hunt.name,
        treasure_text=hunt.treasure_text,
        status=Hunt.Status.DRAFT,
        created_by=created_by,
    )
    for position, step in enumerate(_shuffled(steps, rng)):
        HuntStep.objects.create(
            household=copy.household,
            hunt=copy,
            position=position,
            zone=step.zone,
            riddle=step.riddle,
        )
    return copy


def _shuffled(steps: list[HuntStep], rng: random.Random | None) -> list[HuntStep]:
    """Un ordre **effectivement** différent quand c'est possible.

    ``random.shuffle`` a le droit de rendre la permutation identique — une chance
    sur deux à deux étapes, et le bouton n'aurait alors rien fait sans le dire. On
    retire donc tant que l'ordre ne bouge pas, avec une borne : le hasard n'est
    pas une garantie de terminaison, et une boucle infinie dans une requête HTTP
    coûte un worker.
    """
    picker = rng or random
    if len(steps) < 2:
        return list(steps)
    order = list(steps)
    for _attempt in range(20):
        picker.shuffle(order)
        if [s.id for s in order] != [s.id for s in steps]:
            return order
    # Vingt tirages identiques d'affilée n'arrivent pas ; si le générateur est
    # fixé par un test, une rotation reste un ordre différent.
    return steps[1:] + steps[:1]


def current_step(hunt: Hunt) -> HuntStep | None:
    """La première étape non trouvée — celle que les joueurs cherchent."""
    return hunt.steps.filter(found_at__isnull=True).order_by('position').first()


@transaction.atomic
def record_scan(household, zone) -> dict:
    """Confronte une pièce scannée à la chasse en cours.

    Rend un verdict structuré, jamais une chaîne d'affichage — la vue et le front
    décident du texte, ce service décide de la **vérité**.

    Idempotent : re-scanner une étape déjà trouvée (un enfant qui repasse devant
    la porte) n'est pas une erreur et ne rejoue rien.
    """
    hunt = (
        Hunt.objects.select_for_update()
        .filter(household=household, status=Hunt.Status.ACTIVE)
        .first()
    )
    if hunt is None:
        return {'verdict': VERDICT_NO_HUNT, 'hunt': None, 'step': None}

    step = current_step(hunt)
    if step is None:
        # Chasse active sans étape restante : incohérent, on la referme plutôt
        # que de laisser le foyer devant un écran qui n'avance plus.
        _finish(hunt)
        return {'verdict': VERDICT_FINISHED, 'hunt': hunt, 'step': None}

    if step.zone_id != zone.id:
        already = hunt.steps.filter(zone=zone, found_at__isnull=False).exists()
        verdict = VERDICT_ALREADY_FOUND if already else VERDICT_WRONG_ZONE
        # ⚠️ On ne renvoie **ni** la bonne pièce, **ni** le nombre d'étapes
        # restantes : sinon la triche consiste à scanner toute la maison et à
        # lire la réponse dans le payload.
        return {'verdict': verdict, 'hunt': hunt, 'step': None}

    step.found_at = timezone.now()
    step.save(update_fields=['found_at', 'updated_at'])

    following = current_step(hunt)
    if following is None:
        _finish(hunt)
        return {'verdict': VERDICT_FINISHED, 'hunt': hunt, 'step': None}

    return {'verdict': VERDICT_ADVANCED, 'hunt': hunt, 'step': following}


def _finish(hunt: Hunt) -> None:
    hunt.status = Hunt.Status.DONE
    hunt.finished_at = timezone.now()
    hunt.save(update_fields=['status', 'finished_at', 'updated_at'])
