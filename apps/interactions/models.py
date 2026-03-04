""" 
Interactions models - time-based entries (notes, todos, expenses, maintenance).
"""
import uuid
from django.db import models
from django.contrib.postgres.fields import ArrayField
from django.utils.translation import gettext_lazy as _
from core.models import HouseholdScopedModel
from core.managers import HouseholdScopedManager


class Interaction(HouseholdScopedModel):
    """
    Time-based interaction/entry in household journal.
    Supports multiple types: note, todo, expense, maintenance events.
    Mirrors Supabase interactions table.
    """
    INTERACTION_TYPES = [
        ('note', 'Note'),
        ('todo', 'Todo'),
        ('expense', 'Expense'),
        ('maintenance', 'Maintenance'),
        ('repair', 'Repair'),
        ('installation', 'Installation'),
        ('inspection', 'Inspection'),
        ('warranty', 'Warranty'),
        ('issue', 'Issue'),
        ('upgrade', 'Upgrade'),
        ('replacement', 'Replacement'),
        ('disposal', 'Disposal'),
    ]
    
    STATUS_CHOICES = [
        ('backlog', 'Backlog'),
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('done', 'Done'),
        ('archived', 'Archived'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subject = models.CharField(max_length=500)
    content = models.TextField(blank=True, default='')
    type = models.CharField(
        max_length=50,
        choices=INTERACTION_TYPES,
        default='note'
    )
    status = models.CharField(
        max_length=50,
        choices=STATUS_CHOICES,
        blank=True,
        null=True,
        help_text="Status (mainly for todos)"
    )
    occurred_at = models.DateTimeField(
        help_text="When this interaction occurred"
    )
    tags = ArrayField(
        models.CharField(max_length=100),
        default=list,
        blank=True,
        help_text="Tags for categorization"
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Expense amounts, vendor info, etc."
    )
    enriched_text = models.TextField(
        blank=True,
        help_text="Full-text searchable content with OCR from documents"
    )
    
    # Relations
    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='interactions',
        db_column='project_id'
    )
    zones = models.ManyToManyField(
        'zones.Zone',
        through='InteractionZone',
        related_name='interactions'
    )
    
    objects = HouseholdScopedManager()
    
    class Meta:
        db_table = 'interactions'
        verbose_name = _("interaction")
        verbose_name_plural = _("interactions")
        ordering = ['-occurred_at']
        indexes = [
            models.Index(fields=['household', 'type'], name='idx_int_hh_type'),
            models.Index(fields=['household', '-occurred_at'], name='idx_int_hh_date'),
            models.Index(fields=['project'], name='idx_int_project'),
            models.Index(fields=['status'], name='idx_int_status'),
        ]
    
    def __str__(self):
        return f"{self.subject} ({self.type})"


class InteractionZone(models.Model):
    """
    M2M through table linking interactions to zones.
    Ensures interactions always have at least one zone.
    """
    interaction = models.ForeignKey(
        Interaction,
        on_delete=models.CASCADE,
        db_column='interaction_id'
    )
    zone = models.ForeignKey(
        'zones.Zone',
        on_delete=models.CASCADE,
        db_column='zone_id'
    )
    
    class Meta:
        db_table = 'interaction_zones'
        unique_together = [['interaction', 'zone']]
        indexes = [
            models.Index(fields=['interaction']),
            models.Index(fields=['zone']),
        ]
    
    def __str__(self):
        return f"{self.interaction.subject} - {self.zone.name}"


class InteractionContact(models.Model):
    """M2M link between interactions and contacts."""
    interaction = models.ForeignKey(
        Interaction,
        on_delete=models.CASCADE,
        db_column='interaction_id',
        related_name='interaction_contacts'
    )
    contact = models.ForeignKey(
        'directory.Contact',
        on_delete=models.CASCADE,
        db_column='contact_id',
        related_name='interaction_contacts'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'interaction_contacts'
        unique_together = [['interaction', 'contact']]
        indexes = [
            models.Index(fields=['interaction']),
            models.Index(fields=['contact']),
        ]


class InteractionStructure(models.Model):
    """M2M link between interactions and structures."""
    interaction = models.ForeignKey(
        Interaction,
        on_delete=models.CASCADE,
        db_column='interaction_id',
        related_name='interaction_structures'
    )
    structure = models.ForeignKey(
        'directory.Structure',
        on_delete=models.CASCADE,
        db_column='structure_id',
        related_name='interaction_structures'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'interaction_structures'
        unique_together = [['interaction', 'structure']]
        indexes = [
            models.Index(fields=['interaction']),
            models.Index(fields=['structure']),
        ]


class InteractionDocument(models.Model):
    """M2M link between interactions and documents."""
    interaction = models.ForeignKey(
        Interaction,
        on_delete=models.CASCADE,
        db_column='interaction_id',
        related_name='interaction_documents'
    )
    document = models.ForeignKey(
        'documents.Document',
        on_delete=models.CASCADE,
        db_column='document_id',
        related_name='interaction_documents'
    )
    role = models.TextField(default='attachment')
    note = models.TextField(default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'interaction_documents'
        unique_together = [['interaction', 'document']]
        indexes = [
            models.Index(fields=['interaction']),
            models.Index(fields=['document']),
        ]
