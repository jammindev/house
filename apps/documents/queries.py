"""Lectures de la galerie photo : ce qui reste à trier, et par quelles grappes.

Un seul endroit calcule « non trié » et « une session », parce que deux écrans le
lisent — la pastille de la galerie et le panneau de tri. Le marqueur et le compteur
doivent sortir de la même fonction, sinon ils finissent par se contredire sur la même
donnée (même règle que `banking.queries.allocation_state` face au Contrôle).
"""

from datetime import timedelta

from django.db.models import Count

from .models import Document

#: Au-delà de ce silence entre deux prises de vue, on change de session.
#:
#: Deux heures est un réglage, pas une vérité : il sépare l'après-midi de bricolage du
#: dîner du soir, et garde ensemble les trente photos d'une même balade.
SESSION_GAP = timedelta(hours=2)

#: Combien de photos on lit au plus pour bâtir les grappes d'un écran.
#:
#: `DocumentViewSet` n'est pas encore paginé (lot 1 du parcours 29) : sans cette borne
#: le panneau de tri serait une **seconde** liste chargeant tout le foyer, et il
#: arriverait sur une photothèque entière puisque rien n'a été backfillé.
TRIAGE_WINDOW = 500

#: Combien de grappes un écran de tri montre au plus.
TRIAGE_CLUSTERS = 20

#: Le marqueur qui désigne « personne n'a trié » dans un filtre et dans un compteur.
#:
#: Il porte un nom parce qu'il doit s'écrire : `?purpose=` vide serait indistinguable
#: d'un paramètre oublié, et un paramètre oublié veut dire « toutes ».
UNTRIAGED = 'untriaged'


def untriaged(queryset):
    """Les photos que personne n'a encore rangées.

    ⚠️ `purpose=''` et `purpose='memory'` ne se confondent nulle part : le vide dit que
    personne n'a regardé, `memory` dit qu'on a choisi. Filtrer sur « pas technique ni
    observation » attraperait les deux et rendrait la file aveugle.

    Restreint aux `type='photo'` : l'intention est propre aux photos, une facture n'a
    pas à peupler la file.
    """
    return queryset.filter(type='photo', purpose='')


def cluster_sessions(photos, *, gap=SESSION_GAP, limit=None, window_was_full=False):
    """Regroupe des photos **déjà triées par date décroissante** en sessions.

    Calculé à la lecture, sans aucune colonne de groupe : un regroupement stocké
    devrait être recalculé à chaque correction de date de prise de vue, et la date
    d'une photo se corrige.

    La date qui sert est `effective_date` (`COALESCE(taken_at, created_at)`), pas la
    date d'ajout : quinze photos envoyées d'un coup depuis la feuille de partage du
    téléphone contiennent aussi bien la chaudière de mardi que l'anniversaire de
    samedi. Les grouper par envoi reformerait exactement le mélange qu'on défait.

    `window_was_full` dit que l'appelant a lu une fenêtre bornée et qu'il pourrait donc
    y avoir d'autres photos juste après la dernière : la grappe de queue est alors
    peut-être coupée, et on la laisse pour le prochain écran plutôt que d'en annoncer
    un compte faux.
    """
    clusters = []
    for photo in photos:
        moment = _effective_date(photo)
        if clusters and _within(clusters[-1]['oldest'], moment, gap):
            clusters[-1]['photos'].append(photo)
            clusters[-1]['oldest'] = moment
        else:
            # `newest` / `oldest` plutôt que début / fin : la liste arrive du plus
            # récent au plus ancien, et deux bornes nommées par l'ordre de lecture se
            # liraient à l'envers de ce que l'écran affiche.
            clusters.append({'newest': moment, 'oldest': moment, 'photos': [photo]})

    if window_was_full and len(clusters) > 1:
        clusters.pop()

    if limit is not None:
        clusters = clusters[:limit]
    return clusters


def _effective_date(photo):
    """Le pendant Python de l'annotation SQL — et le même repli, au même endroit."""
    return getattr(photo, 'effective_date', None) or photo.taken_at or photo.created_at


def _within(previous, current, gap):
    """Vrai si deux prises de vue appartiennent au même créneau.

    L'écart se prend en valeur absolue : l'appelant garantit l'ordre décroissant, mais
    deux photos d'une même rafale peuvent porter la même seconde, et un ordre qui
    s'inverse ne doit pas ouvrir une session par photo.
    """
    return abs((previous - current).total_seconds()) <= gap.total_seconds()


def purpose_counts(queryset):
    """Combien de photos par intention, dont le vide — en une requête, sans Python.

    Le vide compte comme une valeur : c'est lui qui alimente « À trier », et un
    compteur absent se lirait comme un zéro, c'est-à-dire comme « rien à signaler ».
    """
    rows = (
        queryset.filter(type='photo')
        .values('purpose')
        .order_by('purpose')
        .annotate(total=Count('id'))
    )
    counts = {value: 0 for value, _label in Document.Purpose.choices}
    counts[UNTRIAGED] = 0
    for row in rows:
        key = row['purpose'] or UNTRIAGED
        counts[key] = row['total']
    return counts
