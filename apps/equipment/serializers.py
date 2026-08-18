from decimal import Decimal

from rest_framework import serializers
from django.utils.translation import gettext_lazy as _

from core.timezones import household_today

from .models import Equipment, EquipmentInteraction
from .services import compute_next_service_due, maintenance_state, warranty_state


class EquipmentPurchaseSerializer(serializers.Serializer):
    """Input for /equipment/{id}/register-purchase/."""

    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True, min_value=Decimal("0")
    )
    supplier = serializers.CharField(required=False, allow_blank=True, default="")
    occurred_at = serializers.DateTimeField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    # Enveloppe à laquelle imputer l'achat. Facultative, mais son absence est
    # l'écart `expense_without_budget` : sans budget, un euro n'est classé par
    # aucun axe (projet et zone disent *sur quoi* et *où*, pas *de quelle
    # nature*). L'offrir à la saisie évite de fabriquer l'écart puis de le
    # réparer.
    budget_id = serializers.UUIDField(required=False, allow_null=True)


class EquipmentServiceSerializer(serializers.Serializer):
    """Input for /equipment/{id}/log-service/.

    ``serviced_on`` est facultatif et vaut « aujourd'hui **chez le foyer** » — le
    cas courant est un geste immédiat, et demander une date à qui vient de
    refermer le capot ajoute un formulaire là où un bouton suffit. Une date
    future est refusée : un entretien qui n'a pas eu lieu repousserait l'échéance
    suivante sur la foi de rien.
    """

    serviced_on = serializers.DateField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_serviced_on(self, value):
        if value is None:
            return value
        request = self.context.get("request")
        household = getattr(request, "household", None)
        if value > household_today(household):
            raise serializers.ValidationError(_("A maintenance cannot be recorded in the future."))
        return value


class EquipmentSerializer(serializers.ModelSerializer):
    next_service_due = serializers.SerializerMethodField()
    zone_name = serializers.CharField(source="zone.name", read_only=True)
    # Les deux verdicts servis à la liste ET à la fiche. Les calculer ici est ce
    # qui garantit qu'aucun écran ne les redérive à sa façon : le front rend un
    # état, il ne compare pas une date à « aujourd'hui » (qui, dans un navigateur,
    # n'est même pas le jour du foyer).
    warranty_state = serializers.SerializerMethodField()
    maintenance_state = serializers.SerializerMethodField()

    class Meta:
        model = Equipment
        fields = [
            "id",
            "household",
            "zone",
            "zone_name",
            "name",
            "category",
            "manufacturer",
            "model",
            "serial_number",
            "purchase_date",
            "purchase_price",
            "purchase_vendor",
            "warranty_expires_on",
            "warranty_provider",
            "warranty_notes",
            "maintenance_interval_months",
            "last_service_at",
            "next_service_due",
            "warranty_state",
            "maintenance_state",
            "status",
            "condition",
            "installed_at",
            "retired_at",
            "notes",
            "tags",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["id", "household", "created_at", "updated_at", "created_by", "updated_by"]

    def _today(self):
        # Le jour du **foyer**, jamais celui du serveur : à minuit passé, un UTC
        # ferait basculer une échéance d'un jour, donc un « en retard » en « à
        # venir » — cf. `core.timezones`.
        household = getattr(self.context.get("request"), "household", None)
        if household is None:
            household = getattr(self.instance, "household", None)
        return household_today(household)

    def get_next_service_due(self, obj):
        return compute_next_service_due(obj.last_service_at, obj.maintenance_interval_months)

    def get_warranty_state(self, obj):
        return warranty_state(obj, self._today())

    def get_maintenance_state(self, obj):
        return maintenance_state(obj, self._today())

    def validate_zone(self, value):
        if value is None:
            return value

        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            return value

        if not value.household.householdmember_set.filter(user=request.user).exists():
            raise serializers.ValidationError(_("Invalid zone or access denied."))

        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)

        zone = attrs.get("zone")
        household = getattr(self.instance, "household", None)
        if household is None:
            household = attrs.get("household")
        if household is None:
            request = self.context.get("request")
            if request is not None:
                household = request.household

        if zone and household and zone.household_id != household.id:
            raise serializers.ValidationError({"zone": _("Zone must belong to the same household as equipment.")})

        return attrs


class EquipmentInteractionSerializer(serializers.ModelSerializer):
    interaction_subject = serializers.CharField(source="interaction.subject", read_only=True)
    interaction_type = serializers.CharField(source="interaction.type", read_only=True)
    interaction_occurred_at = serializers.DateTimeField(source="interaction.occurred_at", read_only=True)

    class Meta:
        model = EquipmentInteraction
        fields = [
            "equipment",
            "interaction",
            "interaction_subject",
            "interaction_type",
            "interaction_occurred_at",
            "role",
            "note",
            "created_at",
            "created_by",
        ]
        read_only_fields = ["created_at", "created_by"]
