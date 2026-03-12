from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError

from core.permissions import IsHouseholdMember
from .models import Tag, TagLink
from .serializers import TagSerializer, TagLinkSerializer


class TagViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsHouseholdMember]
    serializer_class = TagSerializer

    def get_queryset(self):
        queryset = Tag.objects.for_user_households(self.request.user)
        selected_household = self.request.household
        if selected_household:
            queryset = queryset.filter(household=selected_household)

        selected_type = (self.request.query_params.get("type") or "").strip()
        if selected_type:
            queryset = queryset.filter(type=selected_type)

        selected_search = (self.request.query_params.get("search") or "").strip()
        if selected_search:
            queryset = queryset.filter(name__icontains=selected_search)

        queryset = queryset.order_by("name")
        return queryset

    def perform_create(self, serializer):
        household = self.request.household
        if not household:
            raise ValidationError({"household_id": "A valid household context is required."})

        serializer.save(household=household, created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class TagLinkViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsHouseholdMember]
    serializer_class = TagLinkSerializer

    def get_queryset(self):
        queryset = TagLink.objects.filter(
            household_id__in=self.request.user.householdmember_set.values_list("household_id", flat=True)
        ).select_related("tag", "content_type", "created_by", "updated_by")
        selected_household = self.request.household
        if selected_household:
            queryset = queryset.filter(household=selected_household)

        content_type_id = self.request.query_params.get("content_type")
        object_id = self.request.query_params.get("object_id")
        if content_type_id:
            queryset = queryset.filter(content_type_id=content_type_id)
        if object_id:
            queryset = queryset.filter(object_id=object_id)
        return queryset

    def perform_create(self, serializer):
        household = self.request.household
        if not household:
            raise ValidationError({"household_id": "A valid household context is required."})

        tag = serializer.validated_data.get("tag")
        content_type = serializer.validated_data.get("content_type")
        object_id = serializer.validated_data.get("object_id")

        if tag.household_id != household.id:
            raise ValidationError({"tag": "Tag household must match selected household."})

        model_class = content_type.model_class()
        if model_class is None:
            raise ValidationError({"content_type": "Invalid content type."})

        try:
            obj = model_class.objects.get(pk=object_id)
        except model_class.DoesNotExist as exc:
            raise ValidationError({"object_id": "Linked object does not exist."}) from exc

        if hasattr(obj, "household_id") and obj.household_id != household.id:
            raise ValidationError({"object_id": "Linked object household must match selected household."})

        serializer.save(household=household, created_by=self.request.user)

    def perform_update(self, serializer):
        household = self.request.household
        if not household:
            raise ValidationError({"household_id": "A valid household context is required."})

        tag = serializer.validated_data.get("tag", serializer.instance.tag)
        content_type = serializer.validated_data.get("content_type", serializer.instance.content_type)
        object_id = serializer.validated_data.get("object_id", serializer.instance.object_id)

        if tag.household_id != household.id:
            raise ValidationError({"tag": "Tag household must match selected household."})

        model_class = content_type.model_class()
        if model_class is None:
            raise ValidationError({"content_type": "Invalid content type."})

        try:
            obj = model_class.objects.get(pk=object_id)
        except model_class.DoesNotExist as exc:
            raise ValidationError({"object_id": "Linked object does not exist."}) from exc

        if hasattr(obj, "household_id") and obj.household_id != household.id:
            raise ValidationError({"object_id": "Linked object household must match selected household."})

        serializer.save(household=household, updated_by=self.request.user)
