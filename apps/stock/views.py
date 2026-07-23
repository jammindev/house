from decimal import Decimal

from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsHouseholdMember

from .models import StockCategory, StockItem
from .notifications import notify_stock_status_change
from .serializers import (
    StockCategorySerializer,
    StockCategorySummarySerializer,
    StockInventorySerializer,
    StockItemSerializer,
    StockPurchaseSerializer,
    StockQuantityAdjustSerializer,
    build_category_summary,
)
from .services import (
    compute_consumption,
    purchase_stock_item,
    recompute_status,
    record_initial_level,
    record_inventory,
    undo_purchase,
)


class StockCategoryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsHouseholdMember]
    serializer_class = StockCategorySerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "description"]
    ordering_fields = ["sort_order", "name", "created_at", "updated_at"]
    ordering = ["sort_order", "name"]

    def get_queryset(self):
        queryset = StockCategory.objects.for_user_households(self.request.user).select_related("created_by", "updated_by")
        selected_household = self.request.household
        if selected_household:
            queryset = queryset.filter(household=selected_household)
        return queryset

    def perform_create(self, serializer):
        household = self.request.household
        if not household:
            raise ValidationError({"household_id": _("A valid household context is required.")})
        serializer.save(household=household, created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        categories = self.get_queryset().prefetch_related("items")
        payload = build_category_summary(categories)
        serializer = StockCategorySummarySerializer(payload, many=True)
        return Response(serializer.data)


class StockItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsHouseholdMember]
    serializer_class = StockItemSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "zone", "category"]
    search_fields = ["name", "description", "sku", "barcode", "supplier", "notes"]
    ordering_fields = ["name", "quantity", "created_at", "updated_at"]
    ordering = ["name"]

    def get_queryset(self):
        queryset = StockItem.objects.for_user_households(self.request.user).select_related(
            "category", "zone", "created_by", "updated_by"
        )
        selected_household = self.request.household
        if selected_household:
            queryset = queryset.filter(household=selected_household)
        return queryset

    def perform_create(self, serializer):
        household = self.request.household
        if not household:
            raise ValidationError({"household_id": _("A valid household context is required.")})

        item = serializer.save(household=household, created_by=self.request.user)
        # Status is fully derived — never trust an incoming value at creation.
        recompute_status(item)
        item.save(update_fields=["status", "updated_at"])
        # Origin point for the consumption curve — keeps the invariant
        # (last reading == quantity) true from creation. No-op when empty.
        record_initial_level(item=item, user=self.request.user)

    def perform_update(self, serializer):
        old_quantity = Decimal(serializer.instance.quantity)
        item = serializer.save(updated_by=self.request.user)
        # Editing the quantity via the form is a de-facto inventory count: route
        # it through the same path (level reading + status recompute + notify)
        # instead of a silent direct write. Untouched quantity → nothing.
        if Decimal(item.quantity) != old_quantity:
            record_inventory(item=item, user=self.request.user, quantity=Decimal(item.quantity))

    @action(detail=True, methods=["post"], url_path="adjust-quantity")
    def adjust_quantity(self, request, pk=None):
        item = self.get_object()
        serializer = StockQuantityAdjustSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        delta = serializer.validated_data["delta"]
        new_quantity = Decimal(item.quantity) + Decimal(delta)
        if new_quantity < 0:
            raise ValidationError({"delta": _("Adjustment would produce a negative quantity.")})

        old_status = item.status
        item.quantity = new_quantity
        item.last_restocked_at = timezone.now() if delta > 0 else item.last_restocked_at
        recompute_status(item)

        item.updated_by = request.user
        item.save(update_fields=["quantity", "last_restocked_at", "status", "updated_by", "updated_at"])
        notify_stock_status_change(item, old_status, item.status)

        return Response(StockItemSerializer(item, context={"request": request}).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="purchase")
    def purchase(self, request, pk=None):
        """Compose an inbound stock movement with an expense interaction.

        Single-action endpoint delegating to ``services.purchase_stock_item``:
        increments the item quantity by `delta` (recalibrating from
        `remaining_before` when provided) and creates an Interaction(type=expense)
        linked to the item, persisting the dated level readings the consumption
        curve consumes.
        """
        item = self.get_object()
        serializer = StockPurchaseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        item, interaction = purchase_stock_item(
            item=item,
            user=request.user,
            delta=data["delta"],
            amount=data.get("amount"),
            supplier=data.get("supplier", "") or "",
            brand=data.get("brand", "") or "",
            remaining_before=data.get("remaining_before"),
            occurred_at=data.get("occurred_at"),
            notes=data.get("notes", "") or "",
        )

        payload = StockItemSerializer(item, context={"request": request}).data
        payload["interaction_id"] = str(interaction.id)
        return Response(payload, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="inventory")
    def inventory(self, request, pk=None):
        """Set the item quantity to a measured absolute value (an inventory count).

        Delegates to ``services.record_inventory``: unlike ``adjust-quantity``
        (a signed delta), the payload is the *remaining* amount directly. Persists
        an ``inventory`` level reading so the consumption curve has a point.
        """
        item = self.get_object()
        serializer = StockInventorySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        item = record_inventory(
            item=item,
            user=request.user,
            quantity=data["quantity"],
            occurred_at=data.get("occurred_at"),
        )

        return Response(
            StockItemSerializer(item, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="consumption")
    def consumption(self, request, pk=None):
        """Return the item's consumption curve (dated levels) + depletion metrics.

        Delegates to ``services.compute_consumption``. Query param ``period`` is
        one of ``30d``/``90d``/``1y``/``all`` (default ``90d``).
        """
        item = self.get_object()
        period = request.query_params.get("period", "90d")
        return Response(compute_consumption(item, period=period))

    @action(detail=False, methods=["post"], url_path="undo-purchase")
    def undo_purchase(self, request):
        """Reverse a stock purchase created via the agent (undo of ``purchase``).

        Body: ``{"interaction_id": "<uuid>"}``. Delegates to
        ``services.undo_purchase`` (deletes the expense + readings, restores the
        quantity). Idempotent: an already-undone purchase returns 404.
        """
        interaction_id = request.data.get("interaction_id")
        if not interaction_id:
            raise ValidationError({"interaction_id": _("This field is required.")})
        try:
            undo_purchase(
                household=request.household,
                user=request.user,
                interaction_id=interaction_id,
            )
        except LookupError:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)
