"""Invitations become shareable links.

`invited_user` was mandatory, so inviting anybody without a House account was
impossible — and no signup existed, which made the whole invitation system
unusable. An invitation now carries a secret `token` and an optional `email`;
whoever opens `/join/<token>` can create their account and join.

`token` is unique, so it cannot be added in a single `AddField`: Django computes
one default value and writes it to every existing row. Hence add-nullable →
backfill row by row → tighten.
"""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

import households.models


def fill_tokens_and_expiry(apps, schema_editor):
    HouseholdInvitation = apps.get_model("households", "HouseholdInvitation")
    expiry = households.models.default_invitation_expiry()
    for invitation in HouseholdInvitation.objects.filter(token__isnull=True).iterator():
        invitation.token = households.models.generate_invitation_token()
        invitation.expires_at = expiry
        # Carry over the address of an invitation that predates the `email`
        # column, so an existing pending invite stays findable by its address.
        if invitation.invited_user_id and not invitation.email:
            invitation.email = (invitation.invited_user.email or "").strip().lower()
        invitation.save(update_fields=["token", "expires_at", "email"])


def noop(apps, schema_editor):
    """Tokens vanish with the columns — nothing to restore."""


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("households", "0011_retire_banking_module_key"),
    ]

    operations = [
        migrations.AlterField(
            model_name="householdinvitation",
            name="invited_user",
            field=models.ForeignKey(
                blank=True,
                db_column="invited_user_id",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="household_invitations",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="householdinvitation",
            name="email",
            field=models.EmailField(
                blank=True,
                default="",
                help_text="Invited email, lowercased. Blank for a link addressed to nobody in particular.",
                max_length=254,
            ),
        ),
        migrations.AddField(
            model_name="householdinvitation",
            name="token",
            field=models.CharField(max_length=64, null=True),
        ),
        migrations.AddField(
            model_name="householdinvitation",
            name="expires_at",
            field=models.DateTimeField(null=True),
        ),
        migrations.RunPython(fill_tokens_and_expiry, noop),
        migrations.AlterField(
            model_name="householdinvitation",
            name="token",
            field=models.CharField(
                default=households.models.generate_invitation_token,
                help_text="Secret carried by the shared link.",
                max_length=64,
                unique=True,
            ),
        ),
        migrations.AlterField(
            model_name="householdinvitation",
            name="expires_at",
            field=models.DateTimeField(default=households.models.default_invitation_expiry),
        ),
        migrations.AlterField(
            model_name="householdinvitation",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("accepted", "Accepted"),
                    ("declined", "Declined"),
                    ("revoked", "Revoked"),
                ],
                default="pending",
                max_length=20,
            ),
        ),
        migrations.AddIndex(
            model_name="householdinvitation",
            index=models.Index(fields=["email", "status"], name="hhinv_email_status_idx"),
        ),
    ]
