import uuid
from django.db import models
from django.contrib.postgres.fields import ArrayField

from django.utils.translation import gettext_lazy as _
from core.models import HouseholdScopedModel
from core.managers import HouseholdScopedManager


class Equipment(HouseholdScopedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", _("Active")
        MAINTENANCE = "maintenance", _("Maintenance")
        STORAGE = "storage", _("Storage")
        RETIRED = "retired", _("Retired")
        LOST = "lost", _("Lost")
        ORDERED = "ordered", _("Ordered")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    zone = models.ForeignKey("zones.Zone", on_delete=models.SET_NULL, null=True, blank=True, related_name="equipment")
    name = models.TextField()
    category = models.TextField(default="general")
    manufacturer = models.TextField(null=True, blank=True)
    model = models.TextField(null=True, blank=True)
    serial_number = models.TextField(null=True, blank=True)
    purchase_date = models.DateField(null=True, blank=True)
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    purchase_vendor = models.TextField(null=True, blank=True)
    warranty_expires_on = models.DateField(null=True, blank=True)
    warranty_provider = models.TextField(null=True, blank=True)
    warranty_notes = models.TextField(default="", blank=True)
    maintenance_interval_months = models.IntegerField(null=True, blank=True)
    last_service_at = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.ACTIVE)
    condition = models.TextField(default="good", blank=True)
    installed_at = models.DateField(null=True, blank=True)
    retired_at = models.DateField(null=True, blank=True)
    notes = models.TextField(default="", blank=True)
    tags = ArrayField(models.TextField(), default=list, blank=True)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "equipment"
        verbose_name = _("equipment")
        verbose_name_plural = _("equipment")
        indexes = [
            models.Index(fields=["household", "status"], name="idx_equipment_hh_status"),
            models.Index(fields=["zone"], name="idx_equipment_zone"),
        ]


class EquipmentInteraction(models.Model):
    equipment = models.ForeignKey(Equipment, on_delete=models.CASCADE, related_name="equipment_interactions")
    interaction = models.ForeignKey("interactions.Interaction", on_delete=models.CASCADE, related_name="equipment_interactions")
    role = models.TextField(default="log")
    note = models.TextField(default="")
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = "equipment_interactions"
        unique_together = [["equipment", "interaction"]]
