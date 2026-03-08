from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from django.db.models import Q
from urllib.parse import urlencode

from core.permissions import resolve_request_household
from core.views import ReactPageView
from zones.models import Zone

from .models import Interaction


def _resolve_selected_household(request):
    selected_household = resolve_request_household(request, required=False)
    if selected_household:
        return selected_household
    membership = (
        request.user.householdmember_set
        .select_related('household')
        .order_by('household__name')
        .first()
    )
    return membership.household if membership else None


class AppInteractionsView(ReactPageView):
    page_title = _("Activity")
    react_root_id = "interactions-list-root"
    props_script_id = "interactions-list-props"
    page_vite_asset = "src/pages/interactions/list.tsx"

    def get_props(self):
        request = self.request
        selected_type = (request.GET.get('type') or '').strip()
        selected_status = (request.GET.get('status') or '').strip()
        selected_search = (request.GET.get('search') or '').strip()
        highlighted_id = (request.GET.get('created') or '').strip()
        force_reload_on_mount = bool((request.GET.get('refresh') or '').strip())

        selected_household = _resolve_selected_household(request)

        queryset = Interaction.objects.for_user_households(request.user).select_related('created_by').prefetch_related('zones', 'documents', 'tags__tag')
        if selected_household:
            queryset = queryset.filter(household=selected_household)
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
        interactions = list(queryset.order_by('-occurred_at')[:8])
        initial_items = [
            {
                'id': str(item.id),
                'subject': item.subject,
                'content': item.content,
                'type': item.type,
                'status': item.status,
                'occurred_at': item.occurred_at.isoformat(),
                'tags': [link.tag.name for link in item.tags.all()],
                'zone_names': [zone.name for zone in item.zones.all()],
                'document_count': item.documents.count(),
                'created_by_name': item.created_by.full_name if item.created_by else '',
            }
            for item in interactions
        ]

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
    page_title = _("Add event")
    react_root_id = "interaction-create-root"
    props_script_id = "interaction-create-props"
    page_vite_asset = "src/pages/interactions/new.tsx"

    def get_props(self):
        request = self.request
        selected_household = _resolve_selected_household(request)
        return_to = (request.GET.get('return_to') or '').strip()

        zones_queryset = Zone.objects.for_user_households(request.user).select_related('parent')
        if selected_household:
            zones_queryset = zones_queryset.filter(household=selected_household)

        zones_payload = [
            {
                'id': str(zone.id),
                'name': zone.name,
                'parentId': str(zone.parent_id) if zone.parent_id else None,
                'full_path': zone.full_path,
                'color': zone.color,
                'depth': zone.depth,
            }
            for zone in sorted(zones_queryset, key=lambda zone: zone.full_path.lower())
        ]

        if return_to == 'dashboard':
            redirect_to = reverse('app_dashboard')
        else:
            redirect_to = reverse('app_interactions')

        redirect_query = {'refresh': '1'} if return_to != 'dashboard' else {}
        redirect_to_list_url = f"{redirect_to}?{urlencode(redirect_query)}" if redirect_query else redirect_to

        return {
            'title': str(_('Add event')),
            'submitLabel': str(_('Add event')),
            'successMessage': str(_('Event added successfully.')),
            'defaultType': request.GET.get('type', 'note'),
            'initialZones': zones_payload,
            'initialZonesLoaded': True,
            'redirectToListUrl': redirect_to_list_url,
        }
