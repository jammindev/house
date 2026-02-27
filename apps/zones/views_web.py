from django.contrib.auth.decorators import login_required
from django.shortcuts import render

from core.permissions import resolve_request_household

from .models import Zone


@login_required
def app_zones_view(request):
    selected_household = resolve_request_household(request, required=False)
    if not selected_household:
        membership = (
            request.user.householdmember_set
            .select_related('household')
            .order_by('household__name')
            .first()
        )
        selected_household = membership.household if membership else None

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
