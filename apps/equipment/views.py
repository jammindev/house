from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsHouseholdMember
from documents.mixins import DocumentLinkActionsMixin
from core.timezones import household_today
from interactions.models import Interaction
from interactions.serializers import InteractionSerializer
from interactions.services import (
    create_expense_interaction,
    create_service_interaction,
    household_noon,
    validate_expense_budget,
)
from .models import Equipment, EquipmentInteraction
from .serializers import (
    EquipmentInteractionSerializer,
    EquipmentPurchaseSerializer,
    EquipmentSerializer,
    EquipmentServiceSerializer,
)
from .services import ATTENTION_FILTERS, matches_attention


class EquipmentViewSet(DocumentLinkActionsMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsHouseholdMember]
    serializer_class = EquipmentSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "zone", "category"]
    search_fields = ["name", "manufacturer", "model", "serial_number", "notes"]
    ordering_fields = ["name", "created_at", "updated_at", "last_service_at", "warranty_expires_on"]
    ordering = ["name"]

    def get_queryset(self):
        queryset = Equipment.objects.for_user_households(self.request.user).select_related("zone", "created_by", "updated_by")
        selected_household = self.request.household
        if selected_household:
            queryset = queryset.filter(household=selected_household)
        return self._apply_attention_filter(queryset)

    def _apply_attention_filter(self, queryset):
        """Restreindre la liste à une pastille du bandeau (`?attention=`).

        Le tri se fait en Python parce que « en retard » est une arithmétique de
        mois sur une date (``compute_next_service_due``), qu'un ``WHERE`` SQL
        n'exprime pas sans réimplémenter le calcul une seconde fois — et deux
        définitions d'un même verdict, c'est précisément ce que ce chantier
        supprime. Le coût est borné par ce qu'un foyer possède (quelques
        dizaines de lignes), pas par un historique qui grossit.
        """
        key = self.request.query_params.get("attention")
        if not key:
            return queryset
        if key not in ATTENTION_FILTERS:
            raise ValidationError({"attention": _("Unknown attention filter.")})

        today = household_today(self.request.household)
        matching = [
            equipment.pk
            for equipment in queryset
            if matches_attention(equipment, key, today)
        ]
        return queryset.filter(pk__in=matching)

    def perform_create(self, serializer):
        household = self.request.household
        if not household:
            raise ValidationError({"household_id": _("A valid household context is required.")})
        serializer.save(household=household, created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="register-purchase")
    def register_purchase(self, request, pk=None):
        """Enregistrer une **dépense liée** à cet équipement (pièce, réparation…).

        ⚠️ Cette action **n'écrit plus rien sur la fiche**. Elle recopiait
        auparavant montant, fournisseur et date dans ``purchase_price`` /
        ``purchase_vendor`` / ``purchase_date`` : changer un joint à 12 € sur une
        chaudière de 2015 réécrivait donc sa date d'achat à aujourd'hui et son
        prix d'achat à 12 €, sans un mot. Or la dépense courante sur un
        équipement est une pièce ou une réparation, pas le rachat de la machine —
        l'achat initial, lui, se saisit dans la fiche, où il est relu et corrigé.

        Le ``kind`` reste ``equipment_purchase`` : il dit « de l'argent dépensé
        sur cet équipement », ce qui est toujours vrai, et le renommer scinderait
        en deux les agrégats de dépenses déjà en base.
        """
        equipment = self.get_object()
        serializer = EquipmentPurchaseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        amount = serializer.validated_data.get("amount")
        supplier = serializer.validated_data.get("supplier", "") or ""
        occurred_at = serializer.validated_data.get("occurred_at") or timezone.now()
        notes = serializer.validated_data.get("notes", "") or ""
        budget_id = validate_expense_budget(
            equipment.household_id, serializer.validated_data.get("budget_id")
        )

        with transaction.atomic():
            interaction = create_expense_interaction(
                source=equipment,
                user=request.user,
                amount=amount,
                supplier=supplier,
                occurred_at=occurred_at,
                notes=notes,
                kind="equipment_purchase",
                budget_id=budget_id,
                extra_metadata={"equipment_name": equipment.name},
            )

        payload = EquipmentSerializer(equipment, context={"request": request}).data
        payload["interaction_id"] = str(interaction.id)
        return Response(payload, status=status.HTTP_201_CREATED)


    @action(detail=True, methods=["post"], url_path="log-service")
    def log_service(self, request, pk=None):
        """« Entretien fait » — la date **et** la trace, en un geste.

        C'était le trou du module : ``last_service_at`` n'était écrit que par le
        seed, l'import, ou le formulaire d'édition à la main. On faisait
        entretenir la chaudière, on l'enregistrait dans l'historique… et l'app
        continuait d'annoncer la même échéance, alerte comprise. La seule façon
        de la faire bouger était de rouvrir « Modifier » et de retaper une date —
        soit le geste le plus courant du module confié au formulaire le plus long.

        Les deux écritures sont **indissociables et atomiques** : une date qui
        avance sans trace laisse un historique qui ment, une trace sans date
        laisse l'alerte allumée. C'est aussi pourquoi l'``Interaction`` passe par
        ``create_service_interaction`` et non par un ``create`` local.
        """
        equipment = self.get_object()
        serializer = EquipmentServiceSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        serviced_on = serializer.validated_data.get("serviced_on") or household_today(
            equipment.household
        )
        notes = serializer.validated_data.get("notes", "") or ""

        with transaction.atomic():
            equipment.last_service_at = serviced_on
            equipment.updated_by = request.user
            equipment.save(update_fields=["last_service_at", "updated_by", "updated_at"])

            interaction = create_service_interaction(
                source=equipment,
                user=request.user,
                # Midi dans le fuseau du foyer, pour la même raison que les
                # dépenses créées depuis un relevé : à minuit, un entretien du 1er
                # ou du 31 change de mois selon le fuseau qui le relit.
                occurred_at=household_noon(equipment.household, serviced_on),
                notes=notes,
            )
            # La table de liaison reste alimentée : elle est ce que lit le tool
            # `get_related` de l'agent (`equipment/apps.py::_equipment_related`).
            EquipmentInteraction.objects.get_or_create(
                equipment=equipment,
                interaction=interaction,
                defaults={"role": "service", "created_by": request.user},
            )

        payload = EquipmentSerializer(equipment, context={"request": request}).data
        payload["interaction_id"] = str(interaction.id)
        return Response(payload, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        """Tout ce qui est arrivé à cet équipement — les deux liaisons réunies.

        Une interaction s'accroche à un équipement de deux façons : la FK
        polymorphe ``source`` (ce qu'écrivent les services d'achat et
        d'entretien) et la table de liaison ``EquipmentInteraction`` (ce que
        produit un rattachement manuel). L'onglet « Historique » ne lisait que la
        seconde : **une dépense enregistrée depuis la fiche n'y apparaissait
        jamais**, alors qu'elle porte le nom de l'équipement dans son sujet.
        Deux réponses possibles à « que s'est-il passé ? » — donc une seule ici.
        """
        equipment = self.get_object()
        linked_ids = EquipmentInteraction.objects.filter(equipment=equipment).values_list(
            "interaction_id", flat=True
        )
        queryset = (
            Interaction.objects.filter(household_id=equipment.household_id)
            .filter(
                Q(
                    source_content_type=ContentType.objects.get_for_model(Equipment),
                    source_object_id=equipment.pk,
                )
                | Q(id__in=list(linked_ids))
            )
            .select_related("created_by")
            .order_by("-occurred_at")
        )
        page = self.paginate_queryset(queryset)
        serializer = InteractionSerializer(
            page if page is not None else queryset,
            many=True,
            context={"request": request},
        )
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def attention(self, request):
        """Ce qui réclame un geste, compté sur **tout** le parc.

        Volontairement insensible aux filtres de la liste : un bandeau qui
        annoncerait « 0 entretien en retard » parce qu'on regarde le garage
        transformerait un filtre d'affichage en verdict sur le foyer. Les
        compteurs et les pastilles lisent la même fonction
        (``services.matches_attention``), donc cliquer une pastille ramène
        exactement le nombre annoncé.
        """
        queryset = Equipment.objects.for_user_households(request.user)
        if request.household:
            queryset = queryset.filter(household=request.household)
        # Les retirés ne réclament rien : une garantie expirée sur un appareil
        # mis au rebut est un reproche sans geste possible.
        queryset = queryset.exclude(status__in=[Equipment.Status.RETIRED, Equipment.Status.LOST])

        today = household_today(request.household)
        items = list(queryset)
        counts = {
            key: sum(1 for equipment in items if matches_attention(equipment, key, today))
            for key in ATTENTION_FILTERS
        }
        counts["total"] = len(items)
        return Response(counts)

    @action(detail=True, methods=["get"])
    def audit(self, request, pk=None):
        equipment = self.get_object()

        def serialize_user(user):
            if not user:
                return None
            return {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
            }

        return Response(
            {
                "created_by": serialize_user(equipment.created_by),
                "updated_by": serialize_user(equipment.updated_by),
            }
        )


class EquipmentInteractionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsHouseholdMember]
    serializer_class = EquipmentInteractionSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["equipment", "interaction", "role"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = EquipmentInteraction.objects.select_related("equipment", "interaction", "created_by").filter(
            equipment__household_id__in=self.request.user.householdmember_set.values_list("household_id", flat=True)
        )
        selected_household = self.request.household
        if selected_household:
            queryset = queryset.filter(equipment__household=selected_household)
        return queryset

    def perform_create(self, serializer):
        equipment = serializer.validated_data["equipment"]
        interaction = serializer.validated_data["interaction"]
        if not Equipment.objects.for_user_households(self.request.user).filter(id=equipment.id).exists():
            raise ValidationError({"equipment": _("Invalid equipment or access denied.")})
        if equipment.household_id != interaction.household_id:
            raise ValidationError({"interaction": _("Interaction household must match equipment household.")})
        if not Interaction.objects.for_user_households(self.request.user).filter(id=interaction.id).exists():
            raise ValidationError({"interaction": _("Invalid interaction or access denied.")})
        serializer.save(created_by=self.request.user)
