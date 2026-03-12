from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from urllib.parse import urlencode

from core.permissions import resolve_selected_household
from core.views import HouseholdListView, ReactPageView
from documents.models import Document
from equipment.models import Equipment
from projects.models import Project
from zones.models import Zone
from zones.serializers import ZonePickerDetailSerializer

from .models import Interaction
from .serializers import InteractionListPropsSerializer


def _build_source_document_prefill(document):
    subject = (document.name or '').strip()

    notes = (document.notes or '').strip()
    ocr_text = (document.ocr_text or '').strip()
    ocr_excerpt = ''
    if ocr_text:
        ocr_excerpt = ocr_text[:280].strip()
        if len(ocr_text) > 280:
            ocr_excerpt = f"{ocr_excerpt}..."

    initial_content = notes or ocr_excerpt

    return {
        'id': str(document.id),
        'name': document.name,
        'type': document.type,
        'notes': notes,
        'ocrExcerpt': ocr_excerpt,
        'suggestedSubject': subject,
        'suggestedContent': initial_content,
    }


class AppInteractionsView(HouseholdListView):
    model = Interaction
    react_root_id = "interactions-list-root"
    props_script_id = "interactions-list-props"
    page_vite_asset = "src/pages/interactions/list.tsx"

    def get_queryset(self):
        return (
            super().get_queryset()
            .select_related('created_by')
            .prefetch_related('zones', 'documents', 'tags__tag')
        )

    def get_props(self):
        request = self.request
        selected_type = (request.GET.get('type') or '').strip()
        selected_status = (request.GET.get('status') or '').strip()
        selected_search = (request.GET.get('search') or '').strip()
        highlighted_id = (request.GET.get('created') or '').strip()
        force_reload_on_mount = bool((request.GET.get('refresh') or '').strip())

        queryset = self.object_list
        if selected_type:
            queryset = queryset.filter(type=selected_type)
        if selected_status:
            queryset = queryset.filter(status=selected_status)
        if selected_search:
            queryset = queryset.filter(
                Q(subject__icontains=selected_search)
                | Q(content__icontains=selected_search)
                | Q(enriched_text__icontains=selected_search)
                | Q(tags__tag__name__icontains=selected_search)
            ).distinct()

        total_count = queryset.count()
        interactions = queryset.order_by('-occurred_at')[:8]
        initial_items = InteractionListPropsSerializer(interactions, many=True).data

        return {
            'title': str(_('Activity')),
            'search': selected_search,
            'type': selected_type,
            'status': selected_status,
            'limit': 8,
            'emptyMessage': str(_('No activity available yet.')),
            'highlightedId': highlighted_id,
            'initialItems': initial_items,
            'initialCount': total_count,
            'initialLoaded': not force_reload_on_mount,
            'forceReloadOnMount': force_reload_on_mount,
        }


class AppInteractionNewView(ReactPageView):
    react_root_id = "interaction-create-root"
    props_script_id = "interaction-create-props"
    page_vite_asset = "src/pages/interactions/new.tsx"

    def get_props(self):
        request = self.request
        selected_household = resolve_selected_household(request)
        return_to = (request.GET.get('return_to') or '').strip()
        source_document_id = (request.GET.get('source_document_id') or '').strip()
        source_interaction_id = (request.GET.get('source_interaction_id') or '').strip()
        project_id = (request.GET.get('project_id') or '').strip()

        source_document = None
        if source_document_id:
            source_queryset = Document.objects.filter(
                household_id__in=request.user.householdmember_set.values_list('household_id', flat=True)
            )
            if selected_household:
                source_queryset = source_queryset.filter(household=selected_household)
            source_document = get_object_or_404(source_queryset, id=source_document_id)
            selected_household = selected_household or source_document.household

        source_interaction = None
        if source_interaction_id:
            interaction_queryset = Interaction.objects.for_user_households(request.user).prefetch_related('zones')
            if selected_household:
                interaction_queryset = interaction_queryset.filter(household=selected_household)
            try:
                source_interaction = interaction_queryset.get(id=source_interaction_id)
                selected_household = selected_household or source_interaction.household
            except Interaction.DoesNotExist:
                pass

        zones_queryset = Zone.objects.for_user_households(request.user).select_related('parent')
        if selected_household:
            zones_queryset = zones_queryset.filter(household=selected_household)

        zones_sorted = sorted(zones_queryset, key=lambda zone: zone.full_path.lower())
        zones_payload = ZonePickerDetailSerializer(zones_sorted, many=True).data

        if return_to == 'dashboard':
            redirect_to = reverse('app_dashboard')
        else:
            redirect_to = reverse('app_interactions')

        redirect_query = {'refresh': '1'} if return_to != 'dashboard' else {}
        redirect_to_list_url = f"{redirect_to}?{urlencode(redirect_query)}" if redirect_query else redirect_to

        source_document_payload = None
        linked_document_ids = []
        redirect_after_success_url = None
        initial_subject = ''
        initial_content = ''
        if source_document:
            source_document_payload = _build_source_document_prefill(source_document)
            linked_document_ids = [str(source_document.id)]
            redirect_after_success_url = reverse('app_documents_detail', kwargs={'document_id': source_document.id})
            initial_subject = source_document_payload['suggestedSubject']
            initial_content = source_document_payload['suggestedContent']

        source_interaction_payload = None
        initial_zone_ids = []
        if source_interaction:
            source_interaction_payload = {
                'id': str(source_interaction.id),
                'subject': source_interaction.subject,
                'type': source_interaction.type,
            }
            initial_zone_ids = [str(zone.id) for zone in source_interaction.zones.all()]
            if not source_document:
                initial_subject = source_interaction.subject or ''

        source_project = None
        if project_id:
            project_queryset = Project.objects.filter(
                household_id__in=request.user.householdmember_set.values_list('household_id', flat=True)
            )
            if selected_household:
                project_queryset = project_queryset.filter(household=selected_household)
            try:
                source_project = project_queryset.get(id=project_id)
                selected_household = selected_household or source_project.household
                if not initial_zone_ids:
                    initial_zone_ids = [
                        str(pz.zone_id)
                        for pz in source_project.project_zones.select_related('zone').all()
                    ]
            except Exception:
                pass

        initial_project_id = str(source_project.id) if source_project else None
        initial_project_title = source_project.title if source_project else None
        if source_project and not redirect_after_success_url:
            interaction_type = (request.GET.get('type') or '').strip()
            _TYPE_TO_TAB = {
                'todo': 'tasks',
                'note': 'notes',
                'expense': 'expenses',
                'document': 'documents',
            }
            tab = _TYPE_TO_TAB.get(interaction_type, 'timeline')
            project_url = reverse('app_projects_detail', kwargs={'project_id': source_project.id})
            redirect_after_success_url = f"{project_url}?tab={tab}"

        equipment_id = (request.GET.get('equipment_id') or '').strip()
        source_equipment = None
        if equipment_id:
            equipment_queryset = Equipment.objects.filter(
                household_id__in=request.user.householdmember_set.values_list('household_id', flat=True)
            )
            if selected_household:
                equipment_queryset = equipment_queryset.filter(household=selected_household)
            try:
                source_equipment = equipment_queryset.get(id=equipment_id)
                if not initial_zone_ids and source_equipment.zone_id:
                    initial_zone_ids = [str(source_equipment.zone_id)]
            except Exception:
                pass

        initial_equipment_id = str(source_equipment.id) if source_equipment else None
        initial_equipment_name = source_equipment.name if source_equipment else None
        if source_equipment and not redirect_after_success_url:
            redirect_after_success_url = reverse('app_equipment_detail', kwargs={'equipment_id': source_equipment.id})

        zone_ids_param = (request.GET.get('zone_ids') or '').strip()
        if zone_ids_param and not initial_zone_ids:
            initial_zone_ids = [z.strip() for z in zone_ids_param.split(',') if z.strip()]

        return {
            'title': str(_('Add event')),
            'submitLabel': str(_('Add event')),
            'successMessage': str(_('Event added successfully.')),
            'defaultType': request.GET.get('type', 'note'),
            'initialZones': zones_payload,
            'initialZonesLoaded': True,
            'redirectToListUrl': redirect_to_list_url,
            'sourceDocument': source_document_payload,
            'sourceInteraction': source_interaction_payload,
            'linkedDocumentIds': linked_document_ids,
            'redirectAfterSuccessUrl': redirect_after_success_url,
            'initialSubject': initial_subject,
            'initialContent': initial_content,
            'initialZoneIds': initial_zone_ids,
            'initialProjectId': initial_project_id,
            'initialProjectTitle': initial_project_title,
            'initialEquipmentId': initial_equipment_id,
            'initialEquipmentName': initial_equipment_name,
        }
