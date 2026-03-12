from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from .models import InsuranceContract


class InsuranceContractSerializer(serializers.ModelSerializer):
    class Meta:
        model = InsuranceContract
        fields = [
            "id",
            "household",
            "name",
            "provider",
            "contract_number",
            "type",
            "insured_item",
            "start_date",
            "end_date",
            "renewal_date",
            "status",
            "payment_frequency",
            "monthly_cost",
            "yearly_cost",
            "coverage_summary",
            "notes",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["id", "household", "created_at", "updated_at", "created_by", "updated_by"]

    def validate(self, attrs):
        attrs = super().validate(attrs)

        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        monthly_cost = attrs.get("monthly_cost", getattr(self.instance, "monthly_cost", 0))
        yearly_cost = attrs.get("yearly_cost", getattr(self.instance, "yearly_cost", 0))

        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({"end_date": _("End date must be after or equal to start date.")})

        if monthly_cost is not None and monthly_cost < 0:
            raise serializers.ValidationError({"monthly_cost": _("Monthly cost must be non-negative.")})

        if yearly_cost is not None and yearly_cost < 0:
            raise serializers.ValidationError({"yearly_cost": _("Yearly cost must be non-negative.")})

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        household = request.household if request else None
        if household is None:
            raise serializers.ValidationError({"household_id": _("A valid household context is required.")})
        validated_data["household"] = household
        return super().create(validated_data)
