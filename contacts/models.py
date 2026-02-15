import uuid
from django.db import models

from core.models import HouseholdScopedModel
from core.managers import HouseholdScopedManager


class Contact(HouseholdScopedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    structure = models.ForeignKey(
        "structures.Structure",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="contacts",
    )
    first_name = models.TextField(default="")
    last_name = models.TextField(default="")
    position = models.TextField(default="", blank=True)
    notes = models.TextField(default="", blank=True)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "contacts"
        ordering = ["last_name", "first_name", "created_at"]
        indexes = [
            models.Index(fields=["household", "last_name"], name="idx_contacts_hh_last"),
            models.Index(fields=["structure"], name="idx_contacts_structure"),
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name}".strip() or str(self.id)


class Address(HouseholdScopedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contact = models.ForeignKey(
        Contact,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="addresses",
    )
    structure = models.ForeignKey(
        "structures.Structure",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="addresses",
    )
    address_1 = models.TextField(default="")
    address_2 = models.TextField(default="", blank=True)
    zipcode = models.TextField(default="", blank=True)
    city = models.TextField(default="", blank=True)
    country = models.TextField(default="", blank=True)
    label = models.TextField(default="", blank=True)
    is_primary = models.BooleanField(default=False)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "addresses"
        ordering = ["-is_primary", "created_at"]
        indexes = [
            models.Index(fields=["household", "contact"], name="idx_addr_hh_contact"),
            models.Index(fields=["household", "structure"], name="idx_addr_hh_structure"),
        ]


class Email(HouseholdScopedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contact = models.ForeignKey(
        Contact,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="emails",
    )
    structure = models.ForeignKey(
        "structures.Structure",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="emails",
    )
    email = models.EmailField()
    label = models.TextField(default="", blank=True)
    is_primary = models.BooleanField(default=False)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "emails"
        ordering = ["-is_primary", "created_at"]
        indexes = [
            models.Index(fields=["household", "email"], name="idx_email_hh_email"),
        ]


class Phone(HouseholdScopedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contact = models.ForeignKey(
        Contact,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="phones",
    )
    structure = models.ForeignKey(
        "structures.Structure",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="phones",
    )
    phone = models.TextField()
    label = models.TextField(default="", blank=True)
    is_primary = models.BooleanField(default=False)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "phones"
        ordering = ["-is_primary", "created_at"]
        indexes = [
            models.Index(fields=["household", "phone"], name="idx_phone_hh_phone"),
        ]
