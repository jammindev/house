"""Ce que le foyer apprend quand une photo arrive.

Séparé des vues pour la même raison que `stock/notifications.py` et
`households/notifications.py` : un effet de bord qui atteint les autres membres se
lit mieux seul, et la vue d'upload est déjà l'endroit où vivent le stockage, l'EXIF
et la normalisation d'image.
"""
from __future__ import annotations

from datetime import timedelta

from django.utils import timezone
from django.utils.translation import gettext as _

from notifications.models import Notification
from notifications.service import notify_household

from .models import Document
from .queries import UNTRIAGED

#: Au-delà de ce silence, on considère qu'un nouvel envoi commence.
#:
#: Le dialog d'envoi **boucle fichier par fichier** : quinze photos rapportées d'un
#: week-end font quinze appels d'upload. Sans regroupement, le foyer reçoit quinze
#: fois la même nouvelle — et c'est exactement le bruit qui fait couper la cloche.
BURST_WINDOW = timedelta(minutes=30)


def _burst_key(document: Document) -> str:
    """L'identité de la rafale à laquelle `document` appartient.

    Ancrée sur la **première photo de la rafale**, jamais sur une tranche d'horloge
    (`now() // 600`) : une tranche coupe un lot en deux au hasard de l'heure d'envoi,
    et ce hasard-là ne s'explique pas à un utilisateur — il verrait tantôt une
    notification, tantôt deux, pour le même geste.

    Une requête indexée (`idx_docs_creator`), et le résultat est le même pour les
    quinze photos du lot : la clé de dédoublonnage l'est donc aussi.
    """
    started_at = (
        Document.objects.filter(
            household_id=document.household_id,
            created_by_id=document.created_by_id,
            type="photo",
            is_private=False,
            created_at__gte=timezone.now() - BURST_WINDOW,
        )
        .order_by("created_at")
        .values_list("created_at", flat=True)
        .first()
    ) or document.created_at

    return f"photos:{document.created_by_id}:{started_at.isoformat(timespec='seconds')}"


def notify_photo_added(document: Document) -> int:
    """Dire au foyer qu'un membre vient d'ajouter des photos. Renvoie combien.

    Trois silences, et chacun vaut mieux qu'une ligne dans la cloche :

    - **un souvenir** (`purpose='memory'`) — celui qui l'envoie a déjà dit ce que
      c'était, et un souvenir n'attend rien de personne. C'est la seule chose qui
      sépare « viens voir, il y a un truc à traiter » de « j'ai rangé les photos du
      week-end », et elle n'existe que parce que l'intention peut se poser **à
      l'envoi** ;
    - **une photo privée** — personne d'autre ne peut la voir, donc l'annoncer
      poserait dans la cloche une ligne qui ne mène nulle part ;
    - **une rafale déjà annoncée** — voir `_burst_key`.

    ⚠️ Le vide n'est pas `memory` : une photo non triée s'annonce comme les autres,
    et mène à la file de tri. Les confondre ici rendrait muet le cas le plus courant,
    puisque rien n'oblige à trier à l'envoi.
    """
    if document.type != "photo" or document.is_private:
        return 0
    if document.purpose == Document.Purpose.MEMORY:
        return 0

    actor = document.created_by
    if actor is None:
        return 0

    actor_name = actor.full_name
    photo_name = document.name

    def text():
        return (
            _("%(member)s added photos") % {"member": actor_name},
            _("Starting with “%(name)s”.") % {"name": photo_name},
        )

    # L'intention décide de l'écran d'arrivée : avec le défaut « souvenirs » de la
    # galerie, `/app/photos` tout court ne montrerait justement pas ce qu'on annonce.
    # Une notification qui annonce sans mener fait refaire au lecteur la recherche
    # qu'elle venait de faire pour lui.
    shelf = document.purpose or UNTRIAGED

    return len(
        notify_household(
            document.household,
            Notification.Type.PHOTO_ADDED,
            actor=actor,
            text=text,
            url=f"/app/photos?purpose={shelf}",
            dedup_key=_burst_key(document),
            payload={
                "document_id": str(document.id),
                "document_name": photo_name,
                "purpose": document.purpose,
            },
        )
    )
