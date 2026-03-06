from django.contrib.auth.decorators import login_required
from django.shortcuts import render


@login_required
def app_photos_view(request):
    return render(request, 'photos/app/photos.html', {'react_props': {}})
