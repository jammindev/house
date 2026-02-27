from django.contrib.auth.decorators import login_required
from django.shortcuts import render


@login_required
def app_settings_view(request):
    return render(
        request,
        'app_settings/app/settings.html',
        {
            'section': 'settings',
            'title': 'Settings',
            'description': 'Settings page is routed by Django and prepared for a page-scoped React mini-SPA.',
            'mount_id': 'settings-root',
            'react_props': {'section': 'settings'},
        },
    )
