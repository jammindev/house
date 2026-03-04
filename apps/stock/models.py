import uuid

from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.utils.translation import gettext_lazy as _

from core.managers import HouseholdScopedManager
from core.models import HouseholdScopedModel


class StockCategory(HouseholdScopedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.TextField()
    color = models.CharField(max_length=16, default="#94a3b8")
    emoji = models.CharField(max_length=16, default="📦")
    description = models.TextField(default="")
    sort_order = models.IntegerField(default=0)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "stock_categories"
        verbose_name = _("stock category")
        verbose_name_plural = _("stock categories")
        ordering = ["sort_order", "name"]
        unique_together = [["household", "name"]]
        indexes = [
            models.Index(fields=["household", "name"], name="idx_stock_cat_hh_name"),
        ]


class StockItem(HouseholdScopedModel):
    class Status(models.TextChoices):
        IN_STOCK = "in_stock", _("In stock")
        LOW_STOCK = "low_stock", _("Low stock")
        OUT_OF_STOCK = "out_of_stock", _("Out of stock")
        ORDERED = "ordered", _("Ordered")
        EXPIRED = "expired", _("Expired")
        RESERVED = "reserved", _("Reserved")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.ForeignKey(StockCategory, on_delete=models.PROTECT, related_name="items")
    zone = models.ForeignKey("zones.Zone", on_delete=models.SET_NULL, null=True, blank=True, related_name="stock_items")
    name = models.TextField()
    description = models.TextField(default="")
    sku = models.TextField(default="", blank=True)
    barcode = models.TextField(default="", blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    unit = models.CharField(max_length=32, default="unit")
    min_quantity = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    max_quantity = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    purchase_date = models.DateField(null=True, blank=True)
    expiration_date = models.DateField(null=True, blank=True)
    last_restocked_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.IN_STOCK)
    supplier = models.TextField(default="", blank=True)
    notes = models.TextField(default="")
    tags = ArrayField(models.TextField(), default=list, blank=True)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "stock_items"
        verbose_name = _("stock item")
        verbose_name_plural = _("stock items")
        indexes = [
            models.Index(fields=["household", "status"], name="idx_stock_item_hh_status"),
            models.Index(fields=["household", "category"], name="idx_stock_item_hh_cat"),
            models.Index(fields=["zone"], name="idx_stock_item_zone"),
            models.Index(fields=["expiration_date"], name="idx_stock_item_exp"),
        ]
        ordering = ["name"]
