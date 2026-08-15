"""Jeux du foyer — la chasse au trésor (parcours 31, lot 2).

Une chasse est une **session de foyer**, pas un état par utilisateur : un seul
téléphone passe de main en main, et c'est ce qui rend le jeu jouable par des
enfants qui n'ont pas de compte. L'état vit donc en base — jamais en
`localStorage` — pour que la partie survive à un rechargement et au changement
d'appareil.
"""
import uuid

from django.db import models
from django.utils.translation import gettext_lazy as _

from core.managers import HouseholdScopedManager
from core.models import HouseholdScopedModel


class Hunt(HouseholdScopedModel):
    """Une chasse au trésor : une suite d'étapes et un trésor au bout."""

    class Status(models.TextChoices):
        DRAFT = 'draft', _("draft")
        ACTIVE = 'active', _("active")
        DONE = 'done', _("done")
        ABANDONED = 'abandoned', _("abandoned")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.DRAFT
    )
    # Ce que l'écran révèle à la toute dernière étape, et pas une seconde avant.
    # Le sérialiseur de jeu le masque tant que la chasse n'est pas terminée : une
    # fuite ici ne casse pas l'app, elle gâche la partie — et c'est irrattrapable.
    treasure_text = models.TextField(blank=True, default='')
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hunts_created',
    )

    objects = HouseholdScopedManager()

    class Meta:
        db_table = 'games_hunts'
        verbose_name = _("treasure hunt")
        verbose_name_plural = _("treasure hunts")
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['household', 'status']),
        ]
        constraints = [
            # « Une seule chasse active par foyer » est une règle de jeu, donc
            # elle est tenue par la **base** et pas seulement par la vue : deux
            # parties lancées en parallèle sur deux téléphones mélangeraient
            # leurs étapes, et aucun des deux joueurs ne saurait laquelle il joue.
            models.UniqueConstraint(
                fields=['household'],
                condition=models.Q(status='active'),
                name='games_one_active_hunt_per_household',
            ),
        ]

    def __str__(self):
        return self.name


class HuntStep(HouseholdScopedModel):
    """Une étape : une énigme, et la pièce qu'elle désigne."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hunt = models.ForeignKey(Hunt, on_delete=models.CASCADE, related_name='steps')
    position = models.PositiveSmallIntegerField()
    # PROTECT et non CASCADE : supprimer une pièce ne doit pas amputer en silence
    # une chasse en cours. Même arbitrage que `Tree.zone` au parcours 30 — un
    # refus nommé vaut mieux qu'une perte silencieuse.
    zone = models.ForeignKey(
        'zones.Zone', on_delete=models.PROTECT, related_name='hunt_steps'
    )
    riddle = models.TextField(blank=True, default='')
    found_at = models.DateTimeField(null=True, blank=True)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = 'games_hunt_steps'
        verbose_name = _("hunt step")
        verbose_name_plural = _("hunt steps")
        ordering = ['position']
        unique_together = [['hunt', 'position']]
        indexes = [
            models.Index(fields=['hunt', 'position']),
        ]

    def __str__(self):
        return f"{self.position + 1}. {self.zone_id}"
