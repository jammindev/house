import uuid

from django.db import models
from django.utils.translation import gettext_lazy as _

from core.managers import HouseholdScopedManager
from core.models import HouseholdScopedModel


class InsuranceContract(HouseholdScopedModel):
    class InsuranceType(models.TextChoices):
        HEALTH = "health", _("Health")
        HOME = "home", _("Home")
        CAR = "car", _("Car")
        LIFE = "life", _("Life")
        LIABILITY = "liability", _("Liability")
        OTHER = "other", _("Other")

    class InsuranceStatus(models.TextChoices):
        ACTIVE = "active", _("Active")
        SUSPENDED = "suspended", _("Suspended")
        TERMINATED = "terminated", _("Terminated")

    class PaymentFrequency(models.TextChoices):
        MONTHLY = "monthly", _("Monthly")
        QUARTERLY = "quarterly", _("Quarterly")
        YEARLY = "yearly", _("Yearly")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.TextField()
    provider = models.TextField(default="", blank=True)
    contract_number = models.TextField(default="", blank=True)
    type = models.CharField(max_length=32, choices=InsuranceType.choices, default=InsuranceType.OTHER)
    insured_item = models.TextField(default="", blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    renewal_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=32, choices=InsuranceStatus.choices, default=InsuranceStatus.ACTIVE)
    payment_frequency = models.CharField(max_length=32, choices=PaymentFrequency.choices, default=PaymentFrequency.MONTHLY)
    monthly_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    yearly_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    coverage_summary = models.TextField(default="", blank=True)
    notes = models.TextField(default="", blank=True)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "insurance_contracts"
        verbose_name = _("insurance contract")
        verbose_name_plural = _("insurance contracts")
        ordering = ["name"]
        indexes = [
            models.Index(fields=["household"], name="idx_insurance_hh"),
            models.Index(fields=["household", "type"], name="idx_insurance_hh_type"),
            models.Index(fields=["household", "status"], name="idx_insurance_hh_status"),
            models.Index(fields=["renewal_date"], name="idx_insurance_renewal"),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(monthly_cost__gte=0) & models.Q(yearly_cost__gte=0),
                name="insurance_costs_non_negative",
            ),
            models.CheckConstraint(
                check=models.Q(start_date__isnull=True)
                | models.Q(end_date__isnull=True)
                | models.Q(end_date__gte=models.F("start_date")),
                name="insurance_dates_consistent",
            ),
        ]
