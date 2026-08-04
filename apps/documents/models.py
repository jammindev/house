"""
Documents app models - file attachments with OCR text extraction.
"""
from pathlib import Path, PurePosixPath
from uuid import uuid4

from django.core.files.storage import default_storage
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.contrib.postgres.fields import ArrayField
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.utils.text import get_valid_filename
from core.models import TimestampedModel, HouseholdScopedModel


class Document(HouseholdScopedModel):
    """
    File attachment linked to interactions or zones.
    Mirrors Supabase documents table.
    """
    DOCUMENT_TYPES = [
        ('photo', 'Photo'),
        ('document', 'Document'),
        ('invoice', 'Invoice'),
        ('manual', 'Manual'),
        ('warranty', 'Warranty'),
        ('receipt', 'Receipt'),
        ('plan', 'Plan'),
        ('certificate', 'Certificate'),
        ('other', 'Other'),
    ]
    
    # File info
    file_path = models.CharField(
        max_length=500,
        help_text="Storage path: documents/{household_id}/{year}/{month}/{uuid}-{filename}"
    )
    name = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=100, blank=True)
    type = models.CharField(
        max_length=50,
        choices=DOCUMENT_TYPES,
        default='document'
    )
    
    # Content extraction
    ocr_text = models.TextField(
        blank=True,
        help_text="Extracted text from OCR/processing"
    )
    
    # Metadata JSONB
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Size, dimensions, processing status, etc."
    )

    # Date de prise de vue, lue dans l'EXIF à l'upload (voir `documents.exif`).
    #
    # C'est une **colonne**, pas une clé de `metadata` : la galerie trie et regroupe
    # dessus, et `metadata` doit rester affiché, jamais requêté ni contraint (même
    # mouvement que `amount`/`kind`/`supplier` promus sur `Interaction`).
    #
    # `NULL` est un état, pas un zéro : une capture d'écran, un scan ou une image
    # strippée n'ont pas de date de prise. Ne jamais y écrire `created_at` en repli —
    # ça fabriquerait une donnée fausse indistinguable d'une vraie. Le repli se fait à
    # la lecture (`COALESCE`), là où on peut encore dire laquelle des deux on affiche.
    taken_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Capture date read from EXIF. NULL = unknown, never a fallback.",
    )

    class Purpose(models.TextChoices):
        TECHNICAL = 'technical', _('Technical')
        OBSERVATION = 'observation', _('Observation')
        MEMORY = 'memory', _('Memory')

    # L'intention d'une photo : **pourquoi elle existe**.
    #
    # La zone dit *où*, le lien d'entité dit *sur quoi*, `DocumentLink.phase` dit
    # *quand dans le chantier* — aucun des trois ne sépare la preuve du souvenir.
    # C'est le même mouvement que « le budget est la catégorie » côté argent : un
    # projet et une zone disent sur quoi porte un euro, jamais de quelle nature il est.
    #
    # ⚠️ **Le vide n'est pas `memory`.** Vide signifie que personne n'a encore trié —
    # c'est un écart, et il alimente la file « À trier » ; `memory` signifie qu'on a
    # choisi. Les confondre rendrait la file aveugle et l'utilisateur croirait avoir
    # rangé. Même règle que `inflow_nature == ""` qui n'est pas `"other"`, et même
    # principe qu'au parcours 26 : toute entité est soit résolue, soit flaggée.
    #
    # Conséquence : rien n'écrit jamais de repli ici, et aucun backfill n'a été fait à
    # l'introduction du champ — marquer `technical` ce qui est lié à un projet aurait
    # écrit une devinette en base, indistinguable d'un choix de l'utilisateur.
    purpose = models.CharField(
        max_length=16,
        choices=Purpose.choices,
        blank=True,
        default='',
        help_text="Why this photo exists. Empty = nobody sorted it yet, never a fallback.",
    )

    # Privacy
    is_private = models.BooleanField(
        default=False,
        help_text="If True, only the uploader can see this document."
    )

    # Optional notes
    notes = models.TextField(blank=True)
    
    # Foreign keys
    interaction = models.ForeignKey(
        'interactions.Interaction',
        on_delete=models.CASCADE,
        related_name='documents',
        null=True,
        blank=True,
        help_text="Parent interaction (if any)"
    )
    
    class Meta:
        db_table = 'documents'
        verbose_name = _("document")
        verbose_name_plural = _("documents")
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['household', 'type'], name='idx_docs_hh_type'),
            # Le compteur « À trier » est un `COUNT(*)` indexé, jamais une
            # matérialisation en Python — même exigence que les badges du Contrôle.
            models.Index(fields=['household', 'purpose'], name='idx_docs_hh_purpose'),
            models.Index(fields=['interaction'], name='idx_docs_interaction'),
            models.Index(fields=['created_by'], name='idx_docs_creator'),
        ]

    @classmethod
    def build_upload_path(cls, *, household_id, filename: str) -> str:
        original_name = Path(filename or 'document').name
        safe_name = get_valid_filename(original_name) or 'document'
        stamp = timezone.now().strftime('%Y/%m')
        return str(
            PurePosixPath('documents')
            / str(household_id)
            / stamp
            / f'{uuid4().hex}-{safe_name}'
        )


class DocumentLink(models.Model):
    """Polymorphic link between a Document and any household entity.

    Single mechanism replacing the per-model through tables (ZoneDocument,
    ProjectDocument, EquipmentDocument, TaskDocument, InteractionDocument).
    Mirrors ``Interaction.source`` — all linkable entities have a UUID PK, so
    ``object_id`` is a plain UUIDField; the document stays a real FK.
    """

    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name='links',
    )
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        related_name='+',
    )
    object_id = models.UUIDField()
    entity = GenericForeignKey('content_type', 'object_id')

    role = models.TextField(default='document')

    class Phase(models.TextChoices):
        BEFORE = 'before', _('Before')
        DURING = 'during', _('During')
        AFTER = 'after', _('After')

    # Renovation phase of a photo *relative to this entity* (before/during/after
    # works). Empty = unclassified. Generic to all linkable types; only the
    # project photo UI writes it in V1. Contextual to the link, not the document.
    phase = models.CharField(
        max_length=16,
        choices=Phase.choices,
        blank=True,
        default='',
    )
    note = models.TextField(default='', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    class Meta:
        db_table = 'document_links'
        unique_together = [['content_type', 'object_id', 'document']]
        indexes = [
            models.Index(fields=['content_type', 'object_id'], name='idx_doclink_entity'),
        ]

    @property
    def household_id(self):
        """Household of the linked entity — lets ``IsHouseholdMember`` scope links."""
        entity = self.entity
        return entity.household_id if entity is not None else None

