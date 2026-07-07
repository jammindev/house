"""
Water serializers — validation for manual meter readings.

The index monotonicity rules mirror the electricity ``MeterReadingSerializer``:
an index can never be lower than the previous reading nor higher than the next
one, and a household has at most one reading per day.
"""
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from .models import WaterReading


class WaterReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = WaterReading
        fields = [
            "id",
            "household",
            "reading_date",
            "index_m3",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["household", "created_at", "updated_at"]

    def validate_index_m3(self, value):
        if value < 0:
            raise serializers.ValidationError(_("Index cannot be negative."))
        return value

    def validate(self, attrs):
        instance = getattr(self, "instance", None)

        reading_date = attrs.get("reading_date") or (
            instance.reading_date if instance is not None else None
        )
        index_m3 = attrs.get("index_m3")
        if index_m3 is None and instance is not None:
            index_m3 = instance.index_m3

        household_id = self._resolve_household_id(instance)
        if reading_date is None or index_m3 is None or household_id is None:
            return attrs

        siblings = WaterReading.objects.filter(household_id=household_id)
        if instance is not None:
            siblings = siblings.exclude(id=instance.id)

        previous = siblings.filter(reading_date__lt=reading_date).order_by("-reading_date").first()
        if previous is not None and index_m3 < previous.index_m3:
            raise serializers.ValidationError(
                {"index_m3": _("Index is lower than the previous reading.")}
            )
        nxt = siblings.filter(reading_date__gt=reading_date).order_by("reading_date").first()
        if nxt is not None and index_m3 > nxt.index_m3:
            raise serializers.ValidationError(
                {"index_m3": _("Index is higher than the next reading.")}
            )
        if siblings.filter(reading_date=reading_date).exists():
            raise serializers.ValidationError(
                {"reading_date": _("A reading already exists on this date.")}
            )

        return attrs

    def _resolve_household_id(self, instance):
        if instance is not None:
            return instance.household_id
        household_id = self.context.get("household_id")
        if household_id:
            return household_id
        request = self.context.get("request")
        if request is not None and request.household is not None:
            return request.household.id
        return None
