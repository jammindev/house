import uuid
from django.db import models

from core.models import HouseholdScopedModel
from core.managers import HouseholdScopedManager


class Tag(HouseholdScopedModel):
    class TagType(models.TextChoices):
        INTERACTION = "interaction", "Interaction"
        DOCUMENT = "document", "Document"
        CONTACT = "contact", "Contact"
        STRUCTURE = "structure", "Structure"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    type = models.CharField(max_length=50, choices=TagType.choices, default=TagType.INTERACTION)
    name = models.TextField()

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "tags"
        unique_together = [["household", "type", "name"]]
        indexes = [
            models.Index(fields=["household", "type"], name="idx_tags_hh_type"),
        ]

    def __str__(self):
        return self.name


class InteractionTag(models.Model):
    interaction = models.ForeignKey(
        "interactions.Interaction",
        on_delete=models.CASCADE,
        related_name="interaction_tag_links",
    )
    tag = models.ForeignKey(
        Tag,
        on_delete=models.CASCADE,
        related_name="interaction_links",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="interaction_tags_created",
    )

    class Meta:
        db_table = "interaction_tags"
        unique_together = [["interaction", "tag"]]
        indexes = [
            models.Index(fields=["interaction"], name="idx_itag_interaction"),
            models.Index(fields=["tag"], name="idx_itag_tag"),
        ]

    def __str__(self):
        return f"{self.interaction_id} - {self.tag_id}"
