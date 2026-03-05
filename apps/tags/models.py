import uuid
from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError

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


class TagLink(HouseholdScopedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tag = models.ForeignKey(
        Tag,
        on_delete=models.CASCADE,
        related_name="links",
        db_column="tag_id",
    )
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        related_name="tag_links",
        db_column="content_type_id",
    )
    object_id = models.CharField(max_length=64)
    content_object = GenericForeignKey("content_type", "object_id")

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "tag_links"
        unique_together = [["household", "tag", "content_type", "object_id"]]
        indexes = [
            models.Index(fields=["household", "tag"], name="idx_tlink_hh_tag"),
            models.Index(fields=["content_type", "object_id"], name="idx_tlink_object"),
            models.Index(fields=["household", "content_type"], name="idx_tlink_hh_ct"),
        ]

    def clean(self):
        if self.tag_id and self.household_id and self.tag.household_id != self.household_id:
            raise ValidationError({"tag": "Tag household must match link household."})

        if self.content_object and hasattr(self.content_object, "household_id"):
            content_household_id = getattr(self.content_object, "household_id")
            if content_household_id and self.household_id and content_household_id != self.household_id:
                raise ValidationError({"object_id": "Linked object household must match link household."})

    def save(self, *args, **kwargs):
        if self.tag_id and not self.household_id:
            self.household_id = self.tag.household_id
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.tag.name} -> {self.content_type.app_label}.{self.content_type.model}:{self.object_id}"
