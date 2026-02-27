from django.contrib.auth.decorators import login_required
from django.shortcuts import render


@login_required
def app_tasks_view(request):
    return render(
        request,
        'tasks/app/tasks.html',
        {
            'section': 'tasks',
            'title': 'Tasks',
            'description': 'Tasks page is routed by Django and prepared for a page-scoped React mini-SPA.',
            'mount_id': 'tasks-root',
            'react_props': {'section': 'tasks'},
        },
    )
