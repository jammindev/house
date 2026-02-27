from django.contrib.auth.decorators import login_required
from django.shortcuts import render


@login_required
def app_equipment_view(request):
    return render(
        request,
        'equipment/app/equipment.html',
        {
            'section': 'equipment',
            'title': 'Equipment',
            'description': 'Equipment page is routed by Django and prepared for a page-scoped React mini-SPA.',
            'mount_id': 'equipment-root',
            'react_props': {'section': 'equipment'},
        },
    )
