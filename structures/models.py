import uuid
from django.db import models
from django.contrib.postgres.fields import ArrayField

from core.models import HouseholdScopedModel
from core.managers import HouseholdScopedManager


class Structure(HouseholdScopedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.TextField(default="")
    type = models.TextField(default="", blank=True)
    description = models.TextField(default="", blank=True)
    website = models.TextField(default="", blank=True)
    tags = ArrayField(models.TextField(), default=list, blank=True)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "structures"
        ordering = ["name", "created_at"]
        indexes = [
            models.Index(fields=["household", "name"], name="idx_struct_hh_name"),
        ]

    def __str__(self):
        return self.name or str(self.id)
