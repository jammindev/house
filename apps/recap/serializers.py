"""Read serializers for the household monthly recap (parcours 27 lot 3)."""
from __future__ import annotations

from rest_framework import serializers

from .models import HouseholdRecap


class HouseholdRecapSerializer(serializers.ModelSerializer):
    """A recap as the client consumes it: localized cards, no raw snapshot.

    ``chapters`` is rendered from the frozen ``stats`` in the request's active
    language. ``polish`` in the serializer context enables the warmer captions —
    used for a single recap, not for the history list, where one LLM call per row
    would be wasteful. The raw ``stats`` (and its ``_polished`` cache) are never
    exposed: they are an internal format, and publishing them would make every
    client a second renderer.
    """

    chapters = serializers.SerializerMethodField()
    card_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = HouseholdRecap
        fields = ["id", "month", "card_count", "chapters", "created_at"]

    def get_chapters(self, obj):
        from .service import render_recap

        return render_recap(
            obj,
            polish=bool(self.context.get("polish", False)),
            disabled_chapters=self.context.get("disabled_chapters") or (),
        )
