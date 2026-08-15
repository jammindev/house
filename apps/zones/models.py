"""
Zones models - hierarchical spatial organization.
"""
import secrets
import uuid
from django.db import models
from django.contrib.contenttypes.fields import GenericRelation
from django.core.validators import RegexValidator
from django.utils.translation import gettext_lazy as _
from core.models import TimestampedModel, HouseholdScopedModel
from core.managers import HouseholdScopedManager


def generate_zone_token():
    """Unguessable token printed on a zone's QR label (~43 url-safe chars).

    Même patron que ``households.models.generate_invitation_token`` : dans les
    deux cas le jeton **est** l'identifiant, et le détenir suffit.
    """
    return secrets.token_urlsafe(32)


class Zone(HouseholdScopedModel):
    """
    Zone - hierarchical spatial organization (rooms, floors, buildings, etc.).
    Self-referencing parent for hierarchy.
    Color inheritance for nested zones.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='children',
        db_column='parent_id'
    )
    # Rang de la zone parmi ses frères. C'est le seul axe de tri de
    # l'arborescence : un foyer ordonne ses pièces comme il les habite, pas comme
    # l'alphabet les classe. Toujours normalisé en 0..n-1 par
    # `zones.services.reorder_siblings` — voir Meta.ordering.
    position = models.PositiveIntegerField(default=0)
    note = models.TextField(blank=True, default='')
    surface = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Surface area (e.g., square meters)"
    )
    color = models.CharField(
        max_length=7,
        default='#f4f4f5',
        validators=[
            RegexValidator(
                regex=r'^#[0-9A-Fa-f]{6}$',
                message='Color must be a valid hex code (e.g., #f4f4f5)'
            )
        ],
        help_text="Hex color code for zone display"
    )
    document_links = GenericRelation("documents.DocumentLink")
    # Ancrage physique de la pièce (parcours 31) : ce jeton est imprimé sur une
    # étiquette QR collée dans la pièce, et le présenter vaut preuve d'y être.
    #
    # ⚠️ Il est **distinct de `id`**, et ce n'est pas un détail d'implémentation.
    # L'UUID d'une zone circule déjà dans les URLs de l'app, dans les payloads
    # d'API et dans les liens que produit l'agent : s'en servir comme preuve de
    # présence reviendrait à publier la réponse du jeu dans la barre d'adresse.
    # Corollaire tenu par un test : ce champ ne sort **que** par
    # `ZoneViewSet.print_sheet`, jamais par le CRUD.
    qr_token = models.CharField(
        max_length=64,
        unique=True,
        editable=False,
        default=generate_zone_token,
        help_text="Opaque token encoded in the zone's printed QR label",
    )

    objects = HouseholdScopedManager()

    class Meta:
        db_table = 'zones'
        verbose_name = _("zone")
        verbose_name_plural = _("zones")
        # L'ordre du foyer s'applique partout — page Zones, sélecteurs, détail,
        # agent — sans qu'aucun appelant ait à y penser. Deux écrans qui trient
        # différemment la même arborescence se contredisent, et `name` en second
        # critère garantit un ordre stable si deux frères partagent un rang.
        ordering = ['position', 'name']
        unique_together = [['id', 'household']]
        indexes = [
            models.Index(fields=['household', 'parent']),
            models.Index(fields=['parent']),
            # Sert le tri de la fratrie sans passer par un sort en mémoire.
            models.Index(fields=['parent', 'position'], name='idx_zone_parent_position'),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(surface__gte=0) | models.Q(surface__isnull=True),
                name='zones_surface_check'
            ),
            models.CheckConstraint(
                condition=models.Q(color__regex=r'^#[0-9A-Fa-f]{6}$'),
                name='zones_color_hex_check',
            ),
            # Garantit qu'un foyer a exactement une zone racine (parent IS NULL).
            models.UniqueConstraint(
                fields=['household'],
                condition=models.Q(parent__isnull=True),
                name='zones_one_root_per_household',
            ),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        """Validate parent + auto-attach to household root when no parent given."""
        if self.parent and self.parent.household_id != self.household_id:
            raise ValueError("Parent zone must belong to the same household")
        # Auto-attach: si pas de parent et qu'une racine existe déjà → enfant de la racine.
        # (un nouveau household crée sa racine via le signal post_save → ce code la préserve)
        if self.parent_id is None and self._state.adding and self.household_id:
            existing_root = (
                Zone.objects.filter(household_id=self.household_id, parent__isnull=True)
                .exclude(pk=self.pk)
                .first()
            )
            if existing_root is not None:
                self.parent = existing_root
        super().save(*args, **kwargs)

    @property
    def full_path(self):
        """Return full hierarchical path (e.g., 'Building / Floor 1 / Room 101')."""
        if self.parent:
            return f"{self.parent.full_path} / {self.name}"
        return self.name

    @property
    def depth(self):
        """Return depth level in hierarchy (0 = root)."""
        if not self.parent:
            return 0
        return 1 + self.parent.depth

    @property
    def is_root(self):
        return self.parent_id is None

    @classmethod
    def get_root_for(cls, household):
        """Return the household's root zone (creates it if missing)."""
        root = cls.objects.filter(household=household, parent__isnull=True).first()
        if root is None:
            root = cls.objects.create(household=household, name='Maison')
        return root


