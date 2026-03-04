from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsHouseholdMember, resolve_request_household

from .models import StockCategory, StockItem
from .serializers import (
    StockCategorySerializer,
    StockCategorySummarySerializer,
    StockItemSerializer,
    StockQuantityAdjustSerializer,
    build_category_summary,
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
        selected_household = resolve_request_household(self.request, required=False)
        if selected_household:
            queryset = queryset.filter(household=selected_household)
        return queryset

    def perform_create(self, serializer):
        household = resolve_request_household(self.request, required=True)
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
    ordering_fields = ["name", "quantity", "expiration_date", "created_at", "updated_at"]
    ordering = ["name"]

    def get_queryset(self):
        queryset = StockItem.objects.for_user_households(self.request.user).select_related(
            "category", "zone", "created_by", "updated_by"
        )
        selected_household = resolve_request_household(self.request, required=False)
        if selected_household:
            queryset = queryset.filter(household=selected_household)
        return queryset

    def perform_create(self, serializer):
        household = resolve_request_household(self.request, required=True)
        if not household:
            raise ValidationError({"household_id": _("A valid household context is required.")})

        item = serializer.save(household=household, created_by=self.request.user)
        if item.status == StockItem.Status.ORDERED and item.quantity > 0:
            item.last_restocked_at = timezone.now()
            item.save(update_fields=["last_restocked_at", "updated_at"])

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="adjust-quantity")
    def adjust_quantity(self, request, pk=None):
        item = self.get_object()
        serializer = StockQuantityAdjustSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        delta = serializer.validated_data["delta"]
        new_quantity = Decimal(item.quantity) + Decimal(delta)
        if new_quantity < 0:
            raise ValidationError({"delta": _("Adjustment would produce a negative quantity.")})

        item.quantity = new_quantity
        item.last_restocked_at = timezone.now() if delta > 0 else item.last_restocked_at

        if item.quantity <= 0:
            item.status = StockItem.Status.OUT_OF_STOCK
        elif item.min_quantity is not None and item.quantity <= item.min_quantity:
            item.status = StockItem.Status.LOW_STOCK
        elif item.expiration_date and item.expiration_date < timezone.now().date():
            item.status = StockItem.Status.EXPIRED
        elif item.status in [StockItem.Status.LOW_STOCK, StockItem.Status.OUT_OF_STOCK, StockItem.Status.EXPIRED]:
            item.status = StockItem.Status.IN_STOCK

        item.updated_by = request.user
        item.save(update_fields=["quantity", "last_restocked_at", "status", "updated_by", "updated_at"])

        return Response(StockItemSerializer(item, context={"request": request}).data, status=status.HTTP_200_OK)
