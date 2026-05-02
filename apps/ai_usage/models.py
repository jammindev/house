"""
AIUsageLog — single audit table for every AI call (OCR, agent, …).

Each call to the LLM layer (`LLMClient.complete()`, `vision_extract()`, …) writes
one row here. Lot 6 (#109) builds the aggregations + admin UI on top of this
table. Lot 2 only needs the model + the `log_ai_usage()` helper.
"""
from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class AIUsageLog(models.Model):
    """One row per AI provider call. Append-only, never updated."""

    class Feature(models.TextChoices):
        OCR_UPLOAD = "ocr_upload", _("OCR — upload")
        OCR_BACKFILL = "ocr_backfill", _("OCR — backfill")
        AGENT_ASK = "agent_ask", _("Agent — ask")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    household = models.ForeignKey(
        "households.Household",
        on_delete=models.CASCADE,
        related_name="ai_usage_logs",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_usage_logs",
    )
    feature = models.CharField(max_length=32, choices=Feature.choices)
    provider = models.CharField(max_length=32, default="anthropic")
    model = models.CharField(max_length=64)
    input_tokens = models.IntegerField(null=True, blank=True)
    output_tokens = models.IntegerField(null=True, blank=True)
    duration_ms = models.IntegerField()
    success = models.BooleanField(default=True)
    error_type = models.CharField(max_length=64, null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "ai_usage_log"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("household", "feature", "-created_at")),
            models.Index(fields=("feature", "-created_at")),
        ]

    def __str__(self) -> str:
        return f"{self.feature}/{self.model} @ {self.created_at:%Y-%m-%d %H:%M}"
