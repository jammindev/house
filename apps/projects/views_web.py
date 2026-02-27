from django.contrib.auth.decorators import login_required
from django.shortcuts import render


@login_required
def app_projects_view(request):
    return render(
        request,
        'projects/app/projects.html',
        {
            'section': 'projects',
            'title': 'Projects',
            'description': 'Projects page is routed by Django and prepared for a page-scoped React mini-SPA.',
            'mount_id': 'projects-root',
            'react_props': {'section': 'projects'},
        },
    )
