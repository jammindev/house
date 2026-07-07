"""
Water models — manual meter readings of the household's water meter.

Deliberately minimal (parcours consommation, volet eau) : one reading = one
date + one index in m³, scoped to the household. No meter entity, no tariffs,
no imports — the consumption shown in the UI is derived on the fly from the
deltas between consecutive readings (see ``services.consumption_summary``).
"""
import uuid

from django.db import models

from core.managers import HouseholdScopedManager
from core.models import HouseholdScopedModel


class WaterReading(HouseholdScopedModel):
    """A manual reading of the water meter index on a given day."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reading_date = models.DateField()
    index_m3 = models.DecimalField(max_digits=12, decimal_places=3)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "water_readings"
        ordering = ["-reading_date"]
        constraints = [
            models.UniqueConstraint(
                fields=["household", "reading_date"],
                name="uq_water_reading_household_date",
            ),
        ]
        indexes = [
            models.Index(fields=["household", "-reading_date"], name="idx_water_reading_hh_date"),
        ]

    def __str__(self):
        return f"{self.reading_date:%Y-%m-%d} — {self.index_m3} m³"
