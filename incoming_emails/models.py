import uuid
from django.db import models


class IncomingEmail(models.Model):
    class ProcessingStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        PROCESSED = "processed", "Processed"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    household = models.ForeignKey("households.Household", on_delete=models.CASCADE, related_name="incoming_emails")
    message_id = models.TextField()
    from_email = models.TextField()
    from_name = models.TextField(default="")
    to_email = models.TextField()
    subject = models.TextField(default="")
    body_text = models.TextField(default="", blank=True)
    body_html = models.TextField(default="", blank=True)
    processing_status = models.CharField(max_length=32, choices=ProcessingStatus.choices, default=ProcessingStatus.PENDING)
    processing_error = models.TextField(null=True, blank=True)
    interaction = models.ForeignKey("interactions.Interaction", on_delete=models.SET_NULL, null=True, blank=True, related_name="incoming_emails")
    metadata = models.JSONField(default=dict, blank=True)
    received_at = models.DateTimeField()
    processed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="incoming_emails_created")
    updated_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="incoming_emails_updated")

    class Meta:
        db_table = "incoming_emails"
        indexes = [
            models.Index(fields=["household", "processing_status"], name="idx_inmail_hh_status"),
            models.Index(fields=["message_id"], name="idx_inmail_message"),
        ]


class IncomingEmailAttachment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incoming_email = models.ForeignKey(IncomingEmail, on_delete=models.CASCADE, related_name="attachments")
    filename = models.TextField()
    content_type = models.TextField(null=True, blank=True)
    size_bytes = models.BigIntegerField(null=True, blank=True)
    content_base64 = models.TextField(null=True, blank=True)
    document = models.ForeignKey("documents.Document", on_delete=models.SET_NULL, null=True, blank=True, related_name="incoming_email_attachments")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "incoming_email_attachments"
