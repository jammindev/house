"""Ce que le foyer apprend quand un membre écrit une tâche.

Un module à part, comme ``stock/notifications.py`` et ``households/notifications.py``
et pour la même raison : un effet de bord qui atteint les *autres* utilisateurs
se lit mieux seul que fondu dans une vue.

Ce fichier ne sait que **quoi dire**. Le fan-out, l'exclusion de l'auteur, la
langue de chaque destinataire et le respect du mute viennent tous de
``notify_household``.

⚠️ **Ce module n'est pas appelé depuis ``tasks.services.create_task``**, et c'est
délibéré. Le service est la porte commune : ``chickens`` s'en sert pour la corvée
du poulailler — qui a déjà son ``chicken_chore_due`` — ``orchard`` pour ses
travaux saisonniers, et ``seed_demo_data`` pour trois ans de données de
démonstration. Une émission posée là ferait doublon chez le premier et
bavardage chez les deux autres. Les appelants sont donc les points d'entrée qui
signifient « un membre vient d'agir » : la vue REST et le writable de l'agent.
"""
from __future__ import annotations

from django.utils.text import Truncator
from django.utils.translation import gettext as _

from notifications.models import Notification
from notifications.service import notify_household

from .models import Task

#: ``Notification.title`` est un ``varchar(255)`` là où ``Task.subject`` en
#: accepte 500. Sans cette borne, Postgres refuse l'insertion et **la création
#: de la tâche part en 500** : un effet de bord qui casse l'action principale
#: fait perdre le travail de l'utilisateur pour une notification dont il se
#: moquait. Le sujet entier reste dans le payload.
_TITLE_MAX = 255


def notify_task_created(task: Task, actor) -> int:
    """Dire au foyer qu'``actor`` vient d'écrire ``task``. Retourne le nombre d'envois.

    **Une tâche privée ne dit rien du tout.** Le titre de la notification *est*
    le sujet de la tâche : l'annoncer publierait mot pour mot ce que le drapeau
    est censé garder, et en allant chercher le lecteur au lieu d'attendre qu'il
    regarde. C'est la même fuite que ``TaskViewSet.get_queryset`` vient de
    fermer en liste, par une porte que le filtre ne surveille pas.

    Pas de ``dedup_key`` : chaque création est un fait distinct, et deux tâches
    au même sujet sont deux tâches.
    """
    if task.is_private:
        return 0

    # Capturé **hors** du callable : ``text()`` est appelé une fois par
    # destinataire, et relire l'objet à chaque tour coûterait une requête par
    # membre pour une valeur qui ne bouge pas.
    subject = task.subject
    actor_name = actor.full_name

    def text():
        return (
            Truncator(subject).chars(_TITLE_MAX),
            _("New task from %(member)s") % {"member": actor_name},
        )

    told = notify_household(
        task.household,
        Notification.Type.TASK_CREATED,
        actor=actor,
        text=text,
        # La tâche, pas la liste : « Tondre la pelouse » qui atterrit sur deux
        # cents lignes fait refaire au lecteur la recherche que la notification
        # venait de faire pour lui.
        url=f"/app/tasks/{task.id}",
        payload={
            "task_id": str(task.id),
            # Le sujet entier — tronquer l'affichage ne doit pas perdre
            # l'information.
            "task_subject": subject,
        },
    )
    return len(told)
