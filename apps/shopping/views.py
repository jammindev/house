"""Shopping list REST API."""
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from core.permissions import IsHouseholdMember
from stock.models import StockItem

from .models import ShoppingListItem
from .serializers import ShoppingListItemSerializer, StockSuggestionSerializer
from .services import (
    add_stock_item_to_list,
    commit_item_to_stock,
    create_list_item,
    dismiss_suggestion,
    list_suggestions,
    update_list_item,
)


class ShoppingListItemViewSet(viewsets.ModelViewSet):
    """CRUD for the household's shared shopping list.

    Writes delegate to ``shopping.services`` (the same path the agent uses).
    """

    permission_classes = [IsHouseholdMember]
    serializer_class = ShoppingListItemSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["sort_order", "created_at", "checked_at"]
    ordering = ["sort_order", "created_at"]

    def get_queryset(self):
        qs = (
            ShoppingListItem.objects.for_user_households(self.request.user)
            .select_related("stock_item", "stock_item__category", "created_by")
        )
        if self.request.household:
            qs = qs.filter(household=self.request.household)
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.request.household:
            ctx["household_id"] = self.request.household.id
        return ctx

    def perform_create(self, serializer):
        data = serializer.validated_data
        item = create_list_item(
            self.request.household,
            self.request.user,
            label=data.get("label", ""),
            quantity=data.get("quantity"),
            unit=data.get("unit", ""),
            note=data.get("note", ""),
            stock_item=data.get("stock_item"),
        )
        serializer.instance = item

    def perform_update(self, serializer):
        update_list_item(
            self.request.household,
            self.request.user,
            serializer.instance,
            fields=serializer.validated_data,
        )

    @action(detail=False, methods=["post"], url_path="from-stock")
    def from_stock(self, request):
        """Add a stock item to the list (Lot 2), deduped.

        Body: ``{stock_item: <uuid>, quantity?: number, note?: str}``. Returns the
        list line plus ``already_in_list`` so the UI can say "déjà dans la liste".
        """
        stock_item_id = str(request.data.get("stock_item") or "").strip()
        if not stock_item_id:
            raise ValidationError({"stock_item": "This field is required."})
        stock_item = (
            StockItem.objects.for_user_households(request.user)
            .filter(pk=stock_item_id)
            .first()
        )
        if stock_item is None or (
            request.household and str(stock_item.household_id) != str(request.household.id)
        ):
            raise ValidationError({"stock_item": "Invalid stock item or access denied."})

        item, created = add_stock_item_to_list(
            request.household,
            request.user,
            stock_item,
            quantity=request.data.get("quantity"),
            note=request.data.get("note") or "",
        )
        payload = self.get_serializer(item).data
        payload["already_in_list"] = not created
        return Response(
            payload, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )

    @action(detail=False, methods=["post"], url_path="bulk-delete")
    def bulk_delete(self, request):
        """Delete several list lines at once (powers "Clear checked" + its undo)."""
        ids = request.data.get("ids") or []
        if not isinstance(ids, list):
            raise ValidationError({"ids": "Expected a list of ids."})
        deleted, _ = self.get_queryset().filter(pk__in=[str(i) for i in ids]).delete()
        return Response({"deleted": deleted}, status=status.HTTP_200_OK)

    # --- Lot 3: suggestions from low stock -----------------------------------

    @action(detail=False, methods=["get"], url_path="suggestions")
    def suggestions(self, request):
        """Low-stock items to propose adding to the list (not already on it, not dismissed)."""
        items = list_suggestions(request.household)
        return Response(StockSuggestionSerializer(items, many=True).data)

    @action(detail=False, methods=["post"], url_path="suggestions/dismiss")
    def dismiss(self, request):
        """Hide a suggestion until its item is restocked and drops low again."""
        stock_item = self._resolve_household_stock_item(request)
        dismiss_suggestion(request.household, request.user, stock_item)
        return Response(status=status.HTTP_204_NO_CONTENT)

    # --- Lot 4: commit a checked line back into the stock --------------------

    @action(detail=True, methods=["post"], url_path="commit-to-stock")
    def commit_to_stock(self, request, pk=None):
        """Record a purchase from a shopping line (reincrements stock + expense).

        Free-text lines require ``category``; linked lines reuse their stock item.
        On success the line is removed and the stock item is returned.
        """
        item = self.get_object()
        stock_item = commit_item_to_stock(
            request.household,
            request.user,
            item,
            delta=request.data.get("delta"),
            amount=request.data.get("amount"),
            supplier=request.data.get("supplier") or "",
            occurred_at=request.data.get("occurred_at") or None,
            notes=request.data.get("notes") or "",
            category=request.data.get("category"),
            unit=request.data.get("unit"),
        )
        return Response({"stock_item": str(stock_item.id)}, status=status.HTTP_200_OK)

    def _resolve_household_stock_item(self, request) -> StockItem:
        stock_item_id = str(request.data.get("stock_item") or "").strip()
        if not stock_item_id:
            raise ValidationError({"stock_item": "This field is required."})
        stock_item = (
            StockItem.objects.for_user_households(request.user).filter(pk=stock_item_id).first()
        )
        if stock_item is None or (
            request.household and str(stock_item.household_id) != str(request.household.id)
        ):
            raise ValidationError({"stock_item": "Invalid stock item or access denied."})
        return stock_item
