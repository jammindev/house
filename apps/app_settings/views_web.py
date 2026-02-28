from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.utils.translation import gettext_lazy as _

from accounts.serializers import UserSerializer
from households.serializers import HouseholdDetailSerializer
from households.models import Household


@login_required
def app_settings_view(request):
    user_data = UserSerializer(request.user).data
    households_qs = Household.objects.filter(
        householdmember__user=request.user
    ).distinct()
    households_data = HouseholdDetailSerializer(households_qs, many=True).data
    return render(
        request,
        'app_settings/app/settings.html',
        {
            'section': 'settings',
            'title': _('Settings'),
            'description': _('Manage your profile, households, and preferences.'),
            'mount_id': 'settings-root',
            'initial_user': user_data,
            'initial_households': households_data,
        },
    )
