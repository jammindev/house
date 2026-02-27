from django.contrib.auth.decorators import login_required
from django.shortcuts import render


@login_required
def app_documents_view(request):
    return render(
        request,
        'documents/app/documents.html',
        {
            'section': 'documents',
            'title': 'Documents',
            'description': 'Documents page is served by Django with an isolated mount node for interactive UI migration.',
            'mount_id': 'documents-root',
            'react_props': {'section': 'documents'},
        },
    )
