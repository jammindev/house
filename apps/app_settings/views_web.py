import json

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import render
from django.urls import reverse
from django.utils.translation import gettext as _
from django.views.decorators.http import require_POST

from accounts.serializers import UserSerializer
from households.serializers import HouseholdDetailSerializer, HouseholdInvitationSerializer
from households.models import Household, HouseholdMember, HouseholdInvitation


@login_required
def app_settings_view(request):
    user_data = UserSerializer(request.user).data
    households_qs = Household.objects.filter(
        householdmember__user=request.user,
        archived_at__isnull=True,
    ).distinct()
    households_data = HouseholdDetailSerializer(households_qs, many=True).data

    # Read active household from the User model
    active_household_id = (
        str(request.user.active_household_id)
        if request.user.active_household_id
        else None
    )

    # Pending invitations for this user
    pending_invitations_qs = HouseholdInvitation.objects.filter(
        invited_user=request.user,
        status=HouseholdInvitation.Status.PENDING,
    ).select_related('household', 'invited_by').order_by('-created_at')
    pending_invitations_data = HouseholdInvitationSerializer(pending_invitations_qs, many=True).data

    return render(
        request,
        'app_settings/app/settings.html',
        {
            'section': 'settings',
            'title': _('Settings'),
            'description': _('Manage your profile, households, and preferences.'),
            'mount_id': 'settings-root',
            'settings_props': {
                'initialUser': user_data,
                'initialHouseholds': households_data,
                'activeHouseholdId': active_household_id,
                'switchHouseholdUrl': reverse('app_settings_switch_household'),
                'initialPendingInvitations': pending_invitations_data,
                'acceptInvitationUrlTemplate': '/api/households/invitations/{id}/accept/',
                'declineInvitationUrlTemplate': '/api/households/invitations/{id}/decline/',
            },
        },
    )


@login_required
def sidebar_user_fragment_view(request):
    """Returns just the sidebar user info fragment (for HTMX refresh)."""
    return render(request, 'components/_sidebar_user_fragment.html')


@login_required
@require_POST
def switch_household_view(request):
    """Store the chosen household in the session so all web views read it by default."""
    try:
        body = json.loads(request.body)
        household_id = str(body.get('household_id', '')).strip()
    except (json.JSONDecodeError, AttributeError):
        return JsonResponse({'error': _('Invalid JSON')}, status=400)

    if not household_id:
        return JsonResponse({'error': _('household_id required')}, status=400)

    is_member = HouseholdMember.objects.filter(
        household_id=household_id, user_id=request.user.id
    ).exists()
    if not is_member:
        return JsonResponse({'error': _('Forbidden')}, status=403)

    request.user.active_household_id = household_id
    request.user.save(update_fields=['active_household_id'])
    return JsonResponse({'ok': True, 'activeHouseholdId': household_id})
