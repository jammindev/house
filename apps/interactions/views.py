"""
Interaction views for REST API.
"""
import uuid
from datetime import datetime, timedelta

from django.contrib.contenttypes.models import ContentType
from django.db import IntegrityError
from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Count

from core.permissions import IsHouseholdMember
from core.timezones import (
    current_month_range,
    end_of_day,
    household_tz,
    start_of_day,
)
from documents.models import Document, DocumentLink
from zones.models import Zone
from .aggregations import UNBUDGETED, compute_expense_summary
from .models import Interaction, InteractionZone, InteractionContact, InteractionStructure
from .serializers import (
    InteractionSerializer,
    InteractionDetailSerializer,
    InteractionContactSerializer,
    InteractionStructureSerializer,
    InteractionDocumentSerializer,
    ManualExpenseSerializer,
    RenovationSerializer,
    RenovationUpdateSerializer,
)
from .services import (
    create_manual_expense_interaction,
    create_renovation_interaction,
    update_renovation_interaction,
)


def _parse_bound(value: str, household, *, closing: bool) -> datetime:
    """Une borne de période, toujours *aware*, toujours dans le fuseau du foyer.

    Deux erreurs qu'un seul endroit ferme désormais :

    - **une date nue en fin d'intervalle vaut fin de journée.** Le filtre est un
      ``__lte`` : lue à minuit, ``to=2026-07-31`` excluait toutes les dépenses du
      31 ;
    - **une date nue se lit chez le foyer, pas en UTC.** Elle était forcée à
      ``tzinfo=utc`` alors que le panneau Budgets bornait son mois sur le fuseau
      du foyer : les deux écrans annonçaient deux totaux pour la même enveloppe,
      chacun juste selon sa propre borne. Le décalage n'est que de deux heures,
      mais il tombe pile sur la frontière d'un mois — donc sur un budget.

    Un instant explicite (``...T14:00``) est respecté ; naïf, il est simplement
    ancré dans le fuseau du foyer plutôt que dans celui du serveur.
    """
    try:
        day = datetime.strptime(value, '%Y-%m-%d').date()
    except (TypeError, ValueError):
        moment = datetime.fromisoformat(value)
        if timezone.is_naive(moment):
            return moment.replace(tzinfo=household_tz(household))
        return moment
    return end_of_day(day, household) if closing else start_of_day(day, household)


def _parse_period(from_param: str | None, to_param: str | None, household):
    """Resolve from/to query params, defaulting to the household's current month.

    Le défaut passe par ``core.timezones`` — la **même** fonction que le panneau
    Budgets. C'est ce qui garantit qu'ouvrir une enveloppe affiche le total sur
    lequel on vient de cliquer.
    """
    if not from_param and not to_param:
        start, end, _month = current_month_range(household)
        # Fin inclusive : le contrat de l'agrégat est un ``__lte``.
        return start, end - timedelta(microseconds=1)

    from_dt = _parse_bound(from_param, household, closing=False) if from_param else None
    to_dt = _parse_bound(to_param, household, closing=True) if to_param else None
    return from_dt, to_dt


class InteractionViewSet(viewsets.ModelViewSet):
    """
    Interaction CRUD with filtering by type, tags, zones, dates.
    """
    permission_classes = [IsHouseholdMember]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['type', 'is_private', 'created_by']
    search_fields = ['subject', 'content', 'enriched_text', 'tags__tag__name']
    ordering_fields = ['occurred_at', 'created_at', 'subject']
    ordering = ['-occurred_at']

    class Pagination(LimitOffsetPagination):
        default_limit = 8
        max_limit = 100

    pagination_class = Pagination
    
    def get_queryset(self):
        """Filter interactions to households where current user is a member."""
        # ``bank_transaction__account``: the serializer answers « rapprochée ? »
        # and names the operation for the link. Without the join that is two
        # queries per row.
        queryset = Interaction.objects.for_user_households(self.request.user).select_related(
            'created_by', 'budget', 'household', 'bank_transaction__account'
        ).prefetch_related('zones', 'documents', 'source', 'tags__tag')

        selected_household = self.request.household
        if selected_household:
            queryset = queryset.filter(household=selected_household)

        # Exclure des types — le pendant de ``?type=``, et il doit être **serveur**.
        #
        # La page Activité ne montre plus les dépenses : elles ont leur module, avec
        # leurs filtres, leur badge de rapprochement et leur budget, et à cent
        # soixante lignes par mois elles noyaient les notes et les maintenances.
        # Filtrer côté client aurait été plus court et faux : la page est paginée par
        # huit, donc une page de huit dépenses se serait affichée vide sous un
        # compteur qui en annonce huit.
        exclude_type = self.request.query_params.get('exclude_type')
        if exclude_type:
            excluded = [value.strip() for value in exclude_type.split(',') if value.strip()]
            if excluded:
                queryset = queryset.exclude(type__in=excluded)

        # Filter by zone
        zone_id = self.request.query_params.get('zone')
        if zone_id:
            queryset = queryset.filter(zones__id=zone_id)

        # Filter by polymorphic source (e.g. ?source_type=projects.project&source_id=<uuid>)
        source_type = self.request.query_params.get('source_type')
        if source_type:
            try:
                app_label, model = source_type.strip().lower().split('.')
                source_ct = ContentType.objects.get_by_natural_key(app_label, model)
            except (ValueError, ContentType.DoesNotExist):
                return queryset.none()
            queryset = queryset.filter(source_content_type=source_ct)
        source_id = self.request.query_params.get('source_id')
        if source_id:
            try:
                queryset = queryset.filter(source_object_id=uuid.UUID(source_id))
            except ValueError:
                return queryset.none()

        # Filter by contact
        contact_id = self.request.query_params.get('contact')
        if contact_id:
            queryset = queryset.filter(interaction_contacts__contact_id=contact_id)

        # Filter by structure
        structure_id = self.request.query_params.get('structure')
        if structure_id:
            queryset = queryset.filter(interaction_structures__structure_id=structure_id)

        # Filter by date range — **les mêmes bornes que le résumé**, via
        # ``_parse_bound``. La liste et le total affichés côte à côte sur la page
        # d'un budget doivent compter les mêmes dépenses ; comparer une chaîne
        # brute les faisait lire minuit UTC là où l'agrégat lisait le fuseau du
        # foyer.
        household_for_dates = self.request.household
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(
                occurred_at__gte=_parse_bound(start_date, household_for_dates, closing=False)
            )
        if end_date:
            queryset = queryset.filter(
                occurred_at__lte=_parse_bound(end_date, household_for_dates, closing=True)
            )
        
        # Filter by tags
        tags = self.request.query_params.get('tags')
        if tags:
            tag_list = tags.split(',')
            queryset = queryset.filter(tags__tag__name__in=tag_list).distinct()

        # Filter by kind — generic across interaction subtypes. Expense kinds
        # live in the promoted `kind` column; non-expense subtypes (e.g.
        # renovation) keep their discriminator in metadata. Match either so this
        # shared list endpoint filters every subtype uniformly.
        kind = self.request.query_params.get('kind')
        if kind:
            queryset = queryset.filter(Q(kind=kind) | Q(metadata__kind=kind))

        # Filter by supplier (expense-only, now a real column).
        supplier = self.request.query_params.get('supplier')
        if supplier is not None:
            queryset = queryset.filter(supplier=supplier)

        # Filter by budget — « de quoi ce compteur est-il fait ? ».
        #
        # ``budget=none`` est une valeur à part entière, pas l'absence de filtre :
        # « hors budget » est un seau qu'on veut pouvoir ouvrir comme les autres.
        # Sans elle, la seule façon de lister ses dépenses serait de tout charger
        # et de filtrer côté client.
        budget = self.request.query_params.get('budget')
        if budget:
            if budget == UNBUDGETED:
                queryset = queryset.filter(budget__isnull=True)
            else:
                try:
                    queryset = queryset.filter(budget_id=uuid.UUID(budget))
                except ValueError:
                    # Un id malformé ne doit pas renvoyer *tout* le journal : la
                    # liste vide est le seul résultat honnête.
                    return queryset.none()

        return queryset
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return InteractionDetailSerializer
        return InteractionSerializer
    
    def perform_create(self, serializer):
        """Set household and created_by with legacy RLS-style validation."""
        zone_ids = self.request.data.get('zone_ids') or []
        document_ids = self.request.data.get('document_ids') or []
        if not isinstance(zone_ids, list) or not zone_ids:
            raise ValidationError({'zone_ids': 'At least one zone is required.'})
        if not isinstance(document_ids, list):
            raise ValidationError({'document_ids': 'Documents must be provided as a list.'})

        zones = list(
            Zone.objects.for_user_households(self.request.user).filter(id__in=zone_ids)
        )

        if len(zones) != len(zone_ids):
            raise ValidationError({'zone_ids': 'One or more zones are invalid or inaccessible.'})

        household_ids = {str(zone.household_id) for zone in zones}
        if len(household_ids) != 1:
            raise ValidationError({'zone_ids': 'All zones must belong to the same household.'})

        zone_household_id = next(iter(household_ids))
        selected_household = self.request.household
        if selected_household and str(selected_household.id) != zone_household_id:
            raise ValidationError({'household_id': 'Selected household does not match provided zones.'})

        documents = list(
            Document.objects.filter(
                household_id__in=self.request.user.householdmember_set.values_list('household_id', flat=True),
                id__in=document_ids,
            )
        )
        if len(documents) != len(document_ids):
            raise ValidationError({'document_ids': 'One or more documents are invalid or inaccessible.'})
        if any(str(document.household_id) != zone_household_id for document in documents):
            raise ValidationError({'document_ids': 'All documents must belong to the same household as the selected zones.'})

        serializer.save(
            household_id=zone_household_id,
            created_by=self.request.user,
        )
    
    @action(detail=False, methods=['get'])
    def by_type(self, request):
        """Group interactions by type with counts."""
        queryset = self.get_queryset()
        type_counts = {}
        
        for int_type, label in Interaction.INTERACTION_TYPES:
            count = queryset.filter(type=int_type).count()
            if count > 0:
                type_counts[int_type] = {
                    'label': label,
                    'count': count
                }
        
        return Response(type_counts)

    @action(detail=False, methods=['post'], url_path='expenses/manual')
    def expenses_manual(self, request):
        """POST /api/interactions/expenses/manual/

        Create an Interaction(type=expense) NOT linked to a domain object —
        the user-typed `subject` is what gets stored. Used for ad-hoc expenses
        (restaurant, cinema, gift…).
        """
        household = request.household
        if household is None:
            raise ValidationError({"household_id": "A valid household context is required."})

        serializer = ManualExpenseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            interaction = create_manual_expense_interaction(
                household=household,
                user=request.user,
                subject=serializer.validated_data["subject"],
                amount=serializer.validated_data.get("amount"),
                supplier=serializer.validated_data.get("supplier", "") or "",
                occurred_at=serializer.validated_data.get("occurred_at"),
                notes=serializer.validated_data.get("notes", "") or "",
                zone_ids=serializer.validated_data.get("zone_ids") or None,
                budget_id=serializer.validated_data.get("budget_id"),
            )
        except ValueError as exc:
            raise ValidationError({"detail": str(exc)})

        payload = InteractionSerializer(interaction, context={"request": request}).data
        return Response(payload, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='renovation')
    def renovation_create(self, request):
        """POST /api/interactions/renovation/

        Create a renovation/decoration log entry (parcours 13): an Interaction
        discriminated by metadata.kind="renovation", attachable to several zones
        at once. Delegates to interactions.services.create_renovation_interaction.
        """
        household = request.household
        if household is None:
            raise ValidationError({"household_id": "A valid household context is required."})

        serializer = RenovationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            interaction = create_renovation_interaction(
                household=household,
                user=request.user,
                element=data["element"],
                product=data.get("product", "") or "",
                brand=data.get("brand", "") or "",
                reference=data.get("reference", "") or "",
                interaction_type=data.get("interaction_type", "installation"),
                subject=data.get("subject") or None,
                occurred_at=data.get("occurred_at"),
                notes=data.get("notes", "") or "",
                zone_ids=data["zone_ids"],
            )
        except ValueError as exc:
            raise ValidationError({"detail": str(exc)})

        payload = InteractionSerializer(interaction, context={"request": request}).data
        return Response(payload, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'], url_path='renovation')
    def renovation_update(self, request, pk=None):
        """PATCH /api/interactions/{id}/renovation/

        Edit a renovation log entry via the shared service. Every field optional;
        zone_ids resyncs the M2M when provided.
        """
        interaction = self.get_object()
        household = request.household or interaction.household

        serializer = RenovationUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        fields = {
            key: data[key]
            for key in ("element", "product", "brand", "reference",
                        "interaction_type", "subject", "notes", "occurred_at")
            if key in data
        }

        try:
            interaction = update_renovation_interaction(
                household=household,
                user=request.user,
                interaction=interaction,
                fields=fields,
                zone_ids=data.get("zone_ids"),
            )
        except ValueError as exc:
            raise ValidationError({"detail": str(exc)})

        payload = InteractionSerializer(interaction, context={"request": request}).data
        return Response(payload, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='expenses/summary')
    def expenses_summary(self, request):
        """GET /api/interactions/expenses/summary/?from=&to=&supplier=&kind=

        Aggregates expense interactions for the selected household over a
        period. Defaults to the current calendar month when from/to are omitted.
        """
        household = request.household
        if household is None:
            return Response({
                'period': {'from': None, 'to': None},
                'total': '0.00',
                'count': 0,
                'by_kind': [],
                'by_supplier': [],
                'by_month': [],
            })

        from_dt, to_dt = _parse_period(
            request.query_params.get('from'),
            request.query_params.get('to'),
            household,
        )
        supplier = request.query_params.get('supplier')
        kind = request.query_params.get('kind')

        budget = request.query_params.get('budget') or None
        if budget and budget != UNBUDGETED:
            try:
                uuid.UUID(budget)
            except ValueError:
                # Un id malformé atteint le driver comme un crash, pas comme un
                # filtre : un mauvais paramètre est un 400, jamais un 500.
                raise ValidationError({'budget': 'Expected a budget id or "none".'})

        return Response(compute_expense_summary(
            household_id=household.id,
            from_dt=from_dt,
            to_dt=to_dt,
            supplier=supplier if supplier else None,
            kind=kind if kind else None,
            budget=budget,
        ))


class _InteractionLinkBaseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsHouseholdMember]

    def get_queryset(self):
        queryset = self.model.objects.filter(
            interaction__household_id__in=self.request.user.householdmember_set.values_list('household_id', flat=True)
        )
        selected_household = self.request.household
        if selected_household:
            queryset = queryset.filter(interaction__household=selected_household)
        return queryset

    def perform_create(self, serializer):
        interaction = serializer.validated_data.get('interaction')
        if not Interaction.objects.for_user_households(self.request.user).filter(id=interaction.id).exists():
            raise ValidationError({'interaction': 'Invalid interaction or access denied.'})
        serializer.save()


class InteractionContactViewSet(_InteractionLinkBaseViewSet):
    model = InteractionContact
    serializer_class = InteractionContactSerializer


class InteractionStructureViewSet(_InteractionLinkBaseViewSet):
    model = InteractionStructure
    serializer_class = InteractionStructureSerializer


class InteractionDocumentViewSet(_InteractionLinkBaseViewSet):
    """Interaction↔Document links, backed by the polymorphic DocumentLink."""
    serializer_class = InteractionDocumentSerializer

    def _interaction_ct(self):
        return ContentType.objects.get_for_model(Interaction)

    def get_queryset(self):
        int_ids = Interaction.objects.for_user_households(self.request.user).values_list('id', flat=True)
        qs = DocumentLink.objects.filter(
            content_type=self._interaction_ct(), object_id__in=int_ids
        ).select_related('document')
        if self.request.household:
            hh_ids = Interaction.objects.filter(
                household=self.request.household
            ).values_list('id', flat=True)
            qs = qs.filter(object_id__in=hh_ids)
        return qs.order_by('-created_at')

    def perform_create(self, serializer):
        interaction = serializer.validated_data.get('interaction')
        if not Interaction.objects.for_user_households(self.request.user).filter(id=interaction.id).exists():
            raise ValidationError({'interaction': 'Invalid interaction or access denied.'})
        serializer.save()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        interaction = serializer.validated_data['interaction']
        document = serializer.validated_data['document']
        if DocumentLink.objects.filter(
            content_type=self._interaction_ct(), object_id=interaction.id, document=document
        ).exists():
            return Response(
                {
                    'code': 'already_linked',
                    'detail': 'Exact document-interaction link already exists.',
                },
                status=status.HTTP_409_CONFLICT,
            )

        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
