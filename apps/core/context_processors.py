from django.conf import settings


def app_debug_admin_link(request):
    user = request.user
    return {
        "show_django_admin_link": bool(
            settings.DEBUG
            and user.is_authenticated
            and (user.is_staff or user.is_superuser)
        )
    }


def active_household_context(request):
    """Resolve the active household once per request and expose it to all templates.

    React components read this via the `house-global-context` <script> tag injected
    in base_app.html, so views no longer need to pass householdId in react_props.
    """
    user = getattr(request, "user", None)
    if not user or not user.is_authenticated:
        return {"active_household_id": None}

    from core.permissions import resolve_request_household

    household = resolve_request_household(request, required=False)
    if not household:
        membership = (
            user.householdmember_set
            .select_related("household")
            .order_by("household__name")
            .first()
        )
        household = membership.household if membership else None

    return {"active_household_id": str(household.id) if household else None}