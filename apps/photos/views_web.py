from django.contrib.auth.decorators import login_required
from django.shortcuts import render


@login_required
def app_photos_view(request):
    return render(
        request,
        'photos/app/photos.html',
        {
            'section': 'photos',
            'title': 'Photos',
            'description': 'Photos page is routed by Django and prepared for a page-scoped React mini-SPA.',
            'mount_id': 'photos-root',
            'react_props': {'section': 'photos'},
        },
    )
