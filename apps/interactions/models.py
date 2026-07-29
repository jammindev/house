"""
Interactions models - time-based entries (notes, expenses, maintenance).
"""
import uuid
from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey, GenericRelation
from django.contrib.contenttypes.models import ContentType
from django.utils.translation import gettext_lazy as _
from core.models import HouseholdScopedModel
from core.managers import HouseholdScopedManager


class Interaction(HouseholdScopedModel):
    """
    Time-based interaction/entry in household journal.
    Supports multiple types: note, expense, maintenance events.
    Todos are NOT interactions: they were extracted to the Task model
    (tasks.0002_migrate_todos) — a journal entry is a dated flat fact,
    a todo has a state machine. See CLAUDE.md « Interaction vs modèle dédié ».
    """
    INTERACTION_TYPES = [
        ('note', 'Note'),
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
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subject = models.CharField(max_length=500)
    content = models.TextField(blank=True, default='')
    type = models.CharField(
        max_length=50,
        choices=INTERACTION_TYPES,
        default='note'
    )
    is_private = models.BooleanField(
        default=False,
        help_text="Whether this interaction is private to the creator"
    )
    occurred_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this interaction occurred",
    )
    tags = GenericRelation(
        'tags.TagLink',
        content_type_field='content_type',
        object_id_field='object_id',
        related_query_name='interaction',
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Feature-specific extras (delta, unit, brand, recurring_id…). "
                  "Structured money fields are now real columns (amount/kind/supplier)."
    )
    # Expense columns — promoted out of `metadata` so they can be queried,
    # aggregated and indexed in SQL instead of casting JSON text every read
    # (cf. docs/fiches/CARTOGRAPHIE_DEPENSES.md). Only meaningful for
    # type='expense'; null/blank for every other interaction type.
    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Expense amount. Only for type='expense'; null otherwise.",
    )
    kind = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="Expense discriminator (stock_purchase, equipment_purchase, "
                  "project_purchase, chickens_purchase, manual, recurring). "
                  "Empty for non-expense interactions.",
    )
    supplier = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="Expense vendor/supplier. Empty when not applicable.",
    )
    enriched_text = models.TextField(
        blank=True,
        help_text="Full-text searchable content with OCR from documents"
    )
    
    # Relations
    source_content_type = models.ForeignKey(
        ContentType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
        help_text="Polymorphic source: type of the object that triggered this interaction.",
    )
    source_object_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="Polymorphic source: id of the object that triggered this interaction.",
    )
    source = GenericForeignKey('source_content_type', 'source_object_id')
    zones = models.ManyToManyField(
        'zones.Zone',
        through='InteractionZone',
        related_name='interactions',
    )
    budget = models.ForeignKey(
        'budget.Budget',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='interactions',
        help_text=(
            "Optional monthly budget this expense counts against (parcours 21). "
            "Only meaningful for type='expense'; null = hors budget. Deleting the "
            "budget resets this to null, never deletes the expense."
        ),
    )
    recurring_expense = models.ForeignKey(
        'budget.RecurringExpense',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='occurrences',
        help_text=(
            "The recurrence this expense materializes (parcours 26, lot 6). "
            "Promoted out of metadata['recurring_id'] because the conformity "
            "control has to GROUP BY it — and CLAUDE.md forbids querying "
            "metadata: a JSON key can be neither indexed nor constrained. The "
            "JSON key is kept for display."
        ),
    )
    bank_transaction = models.ForeignKey(
        'banking.BankTransaction',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='interactions',
        help_text=(
            "Bank statement line this expense is an allocation of (parcours 25). "
            "There is NO Allocation table: a line split 80/40 simply carries two "
            "expenses, each with its own amount and budget. `amount` therefore "
            "stays a scalar column and the project's nine Sum('amount') "
            "aggregations are untouched. SET_NULL: deleting the bank line never "
            "destroys a journalled fact."
        ),
    )
    reconciled_by = models.CharField(
        max_length=6,
        blank=True,
        default='',
        choices=[('auto', 'Automatic'), ('manual', 'Manual')],
        help_text="How this expense got attached to its bank line.",
    )
    document_links = GenericRelation('documents.DocumentLink')

    objects = HouseholdScopedManager()
    
    class Meta:
        db_table = 'interactions'
        verbose_name = _("interaction")
        verbose_name_plural = _("interactions")
        ordering = ['-occurred_at']
        indexes = [
            models.Index(fields=['household', 'type'], name='idx_int_hh_type'),
            models.Index(fields=['household', '-occurred_at'], name='idx_int_hh_date'),
            models.Index(fields=['household', 'kind'], name='idx_int_hh_kind'),
            models.Index(
                fields=['source_content_type', 'source_object_id'],
                name='idx_int_source',
            ),
            models.Index(fields=['is_private'], name='idx_int_private'),
            # Partial index for the lot 6 matcher: it scans expenses that have an
            # amount but no bank line yet — a small slice of the table that would
            # otherwise be a full scan on every import.
            models.Index(
                fields=['household', 'amount'],
                condition=models.Q(type='expense', bank_transaction__isnull=True),
                name='idx_int_unreconciled_amount',
            ),
            # The double-confirmation detector groups occurrences by recurrence and
            # by month; the partial condition keeps the index to the handful of rows
            # that actually materialize a recurrence.
            models.Index(
                fields=['recurring_expense', 'occurred_at'],
                condition=models.Q(recurring_expense__isnull=False),
                name='idx_int_recurring_occurrence',
            ),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(
                    type__in=[
                        'note',
                        'expense',
                        'maintenance',
                        'repair',
                        'installation',
                        'inspection',
                        'warranty',
                        'issue',
                        'upgrade',
                        'replacement',
                        'disposal',
                    ]
                ),
                name='interactions_type_check',
            ),
            models.CheckConstraint(
                condition=models.Q(occurred_at__isnull=False),
                name='interactions_occurred_at_required',
            ),
        ]
    
    def __str__(self):
        return f"{self.subject} ({self.type})"


class Supplier(HouseholdScopedModel):
    """Le catalogue des fournisseurs du foyer — magasins, prestataires, marchands.

    **Pourquoi une table** et pas les valeurs distinctes de ``Interaction.supplier``,
    qui existaient déjà : sans elle rien n'empêche « Leroy Merlin », « leroy
    merlin » et « LEROY MERLIN » de vivre côte à côte comme trois fournisseurs
    différents. Les chips de filtre en montraient trois, ``by_supplier`` répartissait
    la dépense sur trois lignes, et le rapprochement n'en reconnaissait qu'une. Une
    liste de valeurs libres ne peut pas porter cette contrainte ; c'est le critère
    exact du CLAUDE.md pour sortir d'``Interaction`` — *contrainte DB (unicité) sur
    les données métier*.

    ``normalized_name`` porte l'unicité, ``name`` porte l'orthographe. Le foyer
    écrit « Leroy Merlin » et le voit tel quel partout ; la clé, elle, ignore la
    casse, les accents et les espaces multiples, donc retaper « leroy merlin »
    retombe sur la même ligne au lieu d'en créer une seconde.

    **La table se remplit toute seule.** Aucun écran de gestion, aucune étape
    préalable : chaque écriture de dépense passe par
    ``services.register_supplier``, qui fait le get-or-create et renvoie
    l'orthographe canonique. Demander de déclarer un fournisseur *avant* de
    pouvoir saisir la dépense qui le fait connaître serait exactement le formulaire
    en trop que ce chantier supprime.

    **Pas de FK depuis ``Interaction``, volontairement.** ``supplier`` y reste une
    colonne texte, remplie avec le nom canonique de la table. Une FK obligerait
    ``matching`` — qui cherche le fournisseur en **sous-chaîne** du libellé
    bancaire — à passer par une jointure, transformerait les sept agrégations qui
    lisent la colonne en migration destructive à livrer en deux fois, et ferait
    d'une dépense chez un marchand inconnu une écriture impossible. Le catalogue
    normalise la saisie sans devenir un préalable à l'enregistrement.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, verbose_name=_('name'))
    #: Clé d'unicité — casse, accents et espaces neutralisés. Calculée par
    #: ``services.normalize_supplier_name``, jamais saisie.
    normalized_name = models.CharField(max_length=200, editable=False)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = 'suppliers'
        verbose_name = _('supplier')
        verbose_name_plural = _('suppliers')
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(
                fields=['household', 'normalized_name'],
                name='suppliers_unique_per_household',
            ),
        ]
        indexes = [
            models.Index(fields=['household', 'name'], name='idx_supplier_hh_name'),
        ]

    def __str__(self):
        return self.name


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


