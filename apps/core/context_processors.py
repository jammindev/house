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