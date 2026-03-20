"""
Protected media serving with permission checks.

Production: Django authenticates the request, then returns X-Accel-Redirect
so Nginx serves the file from an internal-only location (/_protected_media/).

Development: Django serves the file directly (standard static serve).
"""
from django.conf import settings
from django.http import HttpResponse, Http404

from households.models import HouseholdMember
from documents.models import Document


def serve_protected_media(request, path):
    if not request.user.is_authenticated:
        return HttpResponse(status=401)

    # Documents are stored under documents/{household_id}/...
    # Verify the requesting user is a member of that household.
    if path.startswith('documents/'):
        parts = path.split('/')
        household_id = parts[1] if len(parts) >= 2 else ''
        if not household_id:
            raise Http404
        is_member = HouseholdMember.objects.filter(
            household_id=household_id,
            user=request.user,
        ).exists()
        if not is_member:
            return HttpResponse(status=403)

        # Second check: respect document-level privacy.
        try:
            doc = Document.objects.get(file_path=path)
            if doc.is_private and doc.created_by != request.user:
                return HttpResponse(status=403)
        except Document.DoesNotExist:
            pass

    # Avatars: authentication alone is sufficient —
    # avatars are visible to other members within the app.

    if settings.DEBUG:
        from django.views.static import serve as static_serve
        return static_serve(request, path, document_root=settings.MEDIA_ROOT)

    response = HttpResponse()
    response['X-Accel-Redirect'] = f'/_protected_media/{path}'
    response['Content-Type'] = ''  # Let Nginx detect from the file extension
    return response
