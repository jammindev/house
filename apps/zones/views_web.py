from django.contrib.auth.decorators import login_required
from django.http import Http404
from django.shortcuts import render

from core.permissions import resolve_request_household

from .models import Zone


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


@login_required
def app_zones_view(request):
    selected_household = _resolve_selected_household(request)

    queryset = Zone.objects.for_user_households(request.user).select_related('parent')
    if selected_household:
        queryset = queryset.filter(household=selected_household)

    zones = list(queryset.order_by('name')[:80])

    zones_page_props = {
        'householdId': str(selected_household.id) if selected_household else None,
        'initialZones': [
            {
                'id': str(zone.id),
                'name': zone.name,
                'fullPath': zone.full_path,
                'color': zone.color,
                'parentId': str(zone.parent_id) if zone.parent_id else None,
            }
            for zone in zones
        ],
    }

    return render(
        request,
        'zones/app/zones.html',
        {
            'zones_page_props': zones_page_props,
            'zones': zones,
        },
    )


@login_required
def app_zone_detail_view(request, zone_id):
    selected_household = _resolve_selected_household(request)

    queryset = Zone.objects.for_user_households(request.user).select_related('parent')
    if selected_household:
        queryset = queryset.filter(household=selected_household)

    zone = queryset.filter(id=zone_id).first()
    if not zone:
        raise Http404('Zone not found')

    photos_count = zone.zonedocument_set.filter(role='photo').count()
    children_count = zone.children.count()

    zone_detail_page_props = {
        'householdId': str(zone.household_id),
        'zoneId': str(zone.id),
        'initialZone': {
            'id': str(zone.id),
            'name': zone.name,
            'parentId': str(zone.parent_id) if zone.parent_id else None,
            'parentName': zone.parent.name if zone.parent else None,
            'note': zone.note,
            'surface': float(zone.surface) if zone.surface is not None else None,
            'color': zone.color,
            'updatedAt': zone.updated_at.isoformat() if zone.updated_at else None,
        },
        'initialStats': {
            'childrenCount': children_count,
            'photosCount': photos_count,
        },
        'initialPhotos': [],
    }

    return render(
        request,
        'zones/app/zone_detail.html',
        {
            'zone': zone,
            'zone_detail_page_props': zone_detail_page_props,
            'children_count': children_count,
            'photos_count': photos_count,
        },
    )
