from django.contrib.auth.decorators import login_required
from django.shortcuts import render


@login_required
def app_documents_view(request):
    return render(request, 'documents/app/documents.html', {'react_props': {}})
