"""
Zones models - hierarchical spatial organization.
"""
import uuid
from django.db import models
from django.core.validators import RegexValidator
from core.models import TimestampedModel, HouseholdScopedModel
from core.managers import HouseholdScopedManager


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

    objects = HouseholdScopedManager()

    class Meta:
        db_table = 'zones'
        unique_together = [['id', 'household']]
        indexes = [
            models.Index(fields=['household', 'parent']),
            models.Index(fields=['parent']),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(surface__gte=0) | models.Q(surface__isnull=True),
                name='zones_surface_check'
            )
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        """Validate parent zone belongs to same household."""
        if self.parent and self.parent.household_id != self.household_id:
            raise ValueError("Parent zone must belong to the same household")
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


class ZoneDocument(models.Model):
    """
    Links photo documents to zones for visualization.
    Documents must be of type 'photo'.
    """
    zone = models.ForeignKey(
        Zone,
        on_delete=models.CASCADE,
        db_column='zone_id'
    )
    document = models.ForeignKey(
        'documents.Document',
        on_delete=models.CASCADE,
        db_column='document_id'
    )
    role = models.CharField(
        max_length=50,
        default='photo',
        help_text="Role of document (typically 'photo')"
    )
    note = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='created_by'
    )

    class Meta:
        db_table = 'zone_documents'
        unique_together = [['zone', 'document']]
        indexes = [
            models.Index(fields=['zone']),
            models.Index(fields=['document']),
            models.Index(fields=['-created_at'], name='idx_zone_docs_created'),
        ]

    def __str__(self):
        return f"{self.zone.name} - {self.document.name}"
