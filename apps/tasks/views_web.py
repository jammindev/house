from django.contrib.auth.decorators import login_required
from django.shortcuts import render

from core.permissions import resolve_request_household


@login_required
def app_tasks_view(request):
    selected_household = resolve_request_household(request, required=False)
    if not selected_household:
        membership = (
            request.user.householdmember_set
            .select_related('household')
            .order_by('household__name')
            .first()
        )
        selected_household = membership.household if membership else None

    react_props = {
        'householdId': str(selected_household.id) if selected_household else None,
    }

    return render(
        request,
        'tasks/app/tasks.html',
        {'react_props': react_props},
    )
