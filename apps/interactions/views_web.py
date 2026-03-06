from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.urls import reverse

from core.permissions import resolve_request_household
from zones.models import Zone

from .models import Interaction


@login_required
def app_interactions_view(request):
    selected_type = (request.GET.get('type') or '').strip()
    selected_status = (request.GET.get('status') or '').strip()
    force_reload_on_mount = bool((request.GET.get('refresh') or '').strip())

    selected_household = resolve_request_household(request, required=False)
    if not selected_household:
        membership = (
            request.user.householdmember_set
            .select_related('household')
            .order_by('household__name')
            .first()
        )
        selected_household = membership.household if membership else None

    queryset = Interaction.objects.for_user_households(request.user).select_related('created_by').prefetch_related('zones', 'documents')
    if selected_household:
        queryset = queryset.filter(household=selected_household)
    if selected_type:
        queryset = queryset.filter(type=selected_type)
    if selected_status:
        queryset = queryset.filter(status=selected_status)

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
            'tags': list(item.tags.select_related('tag').values_list('tag__name', flat=True)),
            'zone_names': [zone.name for zone in item.zones.all()],
            'document_count': item.documents.count(),
            'created_by_name': item.created_by.full_name if item.created_by else '',
        }
        for item in interactions
    ]

    interactions_list_props = {
        'title': 'Latest interactions',
        'type': selected_type,
        'status': selected_status,
        'limit': 8,
        'emptyMessage': 'No interactions available yet.',
        'initialItems': initial_items,
        'initialCount': total_count,
        'initialLoaded': not force_reload_on_mount,
        'forceReloadOnMount': force_reload_on_mount,
    }

    return render(
        request,
        'interactions/app/interactions.html',
        {'interactions_list_props': interactions_list_props},
    )


@login_required
def app_interaction_new_view(request):
    selected_household = resolve_request_household(request, required=False)
    if not selected_household:
        membership = (
            request.user.householdmember_set
            .select_related('household')
            .order_by('household__name')
            .first()
        )
        selected_household = membership.household if membership else None

    zones_queryset = Zone.objects.for_user_households(request.user).select_related('parent')
    if selected_household:
        zones_queryset = zones_queryset.filter(household=selected_household)

    zones_payload = [
        {
            'id': str(zone.id),
            'name': zone.name,
            'full_path': zone.full_path,
            'color': zone.color,
        }
        for zone in zones_queryset.order_by('name')
    ]

    interaction_create_props = {
        'title': 'Create interaction',
        'submitLabel': 'Create',
        'successMessage': 'Interaction created successfully.',
        'defaultType': request.GET.get('type', 'note'),
        'initialZones': zones_payload,
        'initialZonesLoaded': True,
        'redirectToListUrl': f"{reverse('app_interactions')}?refresh=1",
    }

    return render(
        request,
        'interactions/app/interaction_new.html',
        {
            'interaction_create_props': interaction_create_props,
        }
    )
