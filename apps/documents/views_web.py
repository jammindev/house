from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils.translation import gettext_lazy as _

from core.permissions import resolve_request_household
from core.views import ReactPageView

from .models import Document
from .serializers import DocumentDetailSerializer, DocumentSerializer
from .views import get_documents_queryset_for_request, get_recent_interaction_candidates


def _resolve_selected_household(request):
    selected_household = resolve_request_household(request, required=False)
    if selected_household:
        return selected_household
    membership = (
        request.user.householdmember_set
        .select_related('household')
        .order_by('household__name')
        .first()
    )
    return membership.household if membership else None


class AppDocumentsView(ReactPageView):
    react_root_id = "documents-root"
    props_script_id = "documents-props"
    page_vite_asset = "src/pages/documents/list.tsx"

    def get_props(self):
        queryset = get_documents_queryset_for_request(self.request)
        initial_documents = DocumentSerializer(
            queryset[:12],
            many=True,
            context={'request': self.request},
        ).data
        without_activity_count = queryset.filter(interaction_documents__isnull=True).distinct().count()

        return {
            'createUrl': reverse('app_documents_new'),
            'initialDocuments': list(initial_documents),
            'initialLoaded': True,
            'initialCounts': {
                'total': queryset.count(),
                'withoutActivity': without_activity_count,
            },
            'filterDefaults': {
                'withoutActivityOnly': False,
            },
        }


class AppDocumentCreateView(ReactPageView):
    react_root_id = "document-create-root"
    props_script_id = "document-create-props"
    page_vite_asset = "src/pages/documents/new.tsx"

    def get_props(self):
        allowed_types = [
            {'value': value, 'label': label}
            for value, label in Document.DOCUMENT_TYPES
            if value != 'photo'
        ]
        return {
            'cancelUrl': reverse('app_documents'),
            'allowedTypes': allowed_types,
            'defaultType': None,
            'uploadApiUrl': '/api/documents/documents/upload/',
            'successRedirectMode': 'document-detail',
        }


class AppDocumentDetailView(ReactPageView):
    react_root_id = "document-detail-root"
    props_script_id = "document-detail-props"
    page_vite_asset = "src/pages/documents/detail.tsx"

    def get_props(self):
        queryset = get_documents_queryset_for_request(self.request)
        document = get_object_or_404(queryset, id=self.kwargs['document_id'])
        selected_household = _resolve_selected_household(self.request) or document.household
        recent_candidates = get_recent_interaction_candidates(
            self.request,
            selected_household,
            document_id=document.id,
        )
        initial_document = DocumentDetailSerializer(
            document,
            context={
                'request': self.request,
                'recent_interaction_candidates': recent_candidates,
            },
        ).data
        file_url = initial_document.get('file_url')
        document_id = str(document.id)
        return {
            'documentId': document_id,
            'listUrl': reverse('app_documents'),
            'fileUrl': file_url,
            'attachInteractionApiUrl': reverse('interaction-document-list'),
            'createInteractionUrl': f"{reverse('app_interaction_new')}?source_document_id={document_id}",
            'createTaskUrl': f"{reverse('app_interaction_new')}?type=todo&source_document_id={document_id}",
            'initialDocument': initial_document,
            'initialRecentInteractionCandidates': recent_candidates,
            'initialLoaded': True,
        }
