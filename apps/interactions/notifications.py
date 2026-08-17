"""Ce que le foyer apprend quand un membre laisse une note dans le journal.

Jumeau de ``tasks/notifications.py`` — même découpage, mêmes garanties, et la
même règle d'appel : le service partagé (``create_note_interaction``) reste muet,
seuls les points d'entrée « un membre vient d'agir » parlent. ``seed_demo_data``
passe par ce service pour écrire trois ans de journal.

Deux règles n'appartiennent qu'ici :

- **le type ``note`` uniquement.** ``InteractionViewSet`` sert les onze types du
  journal ; notifier sur l'endpoint entier ferait sonner chaque achat de stock,
  chaque ligne de relevé ventilée et chaque entrée de carnet de rénovation. Ces
  faits ont déjà leurs écrans, et le bruit est ce qui fait couper une cloche.
- **la rétractation.** Une note se supprime pour de bon, là où une tâche
  s'archive et garde sa page. Sans ``retract_note_created``, l'annonce survit à
  son sujet et mène à un écran mort.
"""
from __future__ import annotations

from django.utils.text import Truncator
from django.utils.translation import gettext as _

from notifications.models import Notification
from notifications.service import notify_household, retract_by_payload

from .models import Interaction

#: Même borne, même raison que pour les tâches : ``Interaction.subject`` accepte
#: 500 caractères, ``Notification.title`` 255.
_TITLE_MAX = 255


def notify_note_created(note: Interaction, actor) -> int:
    """Dire au foyer qu'``actor`` vient d'écrire ``note``. Retourne le nombre d'envois.

    Muet sur une note privée (le titre *est* le sujet) et sur tout ce qui n'est
    pas une note. La garde de type vit **ici** plutôt qu'au point d'appel : elle
    tient alors pour tout appelant présent et à venir, et un appelant qui
    l'oublierait ne transformerait pas le journal entier en sonnerie.
    """
    if note.type != "note" or note.is_private:
        return 0

    subject = note.subject
    actor_name = actor.full_name

    def text():
        return (
            Truncator(subject).chars(_TITLE_MAX),
            _("New note from %(member)s") % {"member": actor_name},
        )

    told = notify_household(
        note.household,
        Notification.Type.NOTE_CREATED,
        actor=actor,
        text=text,
        url=f"/app/interactions/{note.id}",
        payload={"note_id": str(note.id), "note_subject": subject},
    )
    return len(told)


def retract_note_created(note_id) -> int:
    """Retirer l'annonce d'une note supprimée. Retourne le nombre de retraits.

    Appelé depuis les deux chemins de suppression — le DELETE de l'API et l'undo
    de l'agent — parce que le lien meurt de la même façon dans les deux cas.
    Sans ça, la cloche mènerait à un écran vide et le lecteur ne pourrait pas
    savoir si c'est l'app ou lui qui se trompe.
    """
    return retract_by_payload(Notification.Type.NOTE_CREATED, note_id=str(note_id))
