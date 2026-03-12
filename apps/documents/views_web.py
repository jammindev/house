from django.shortcuts import get_object_or_404
from django.urls import reverse

from core.views import ReactPageView

from .models import Document


class AppDocumentsView(ReactPageView):
    react_root_id = "documents-root"
    props_script_id = "documents-props"
    page_vite_asset = "src/pages/documents/list.tsx"

    def get_props(self):
        return {
            'createUrl': reverse('app_documents_new'),
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
        from .views import get_documents_queryset_for_request
        queryset = get_documents_queryset_for_request(self.request)
        document = get_object_or_404(queryset, id=self.kwargs['document_id'])
        document_id = str(document.id)
        return {
            'documentId': document_id,
            'listUrl': reverse('app_documents'),
            'attachInteractionApiUrl': reverse('interaction-document-list'),
            'createInteractionUrl': f"{reverse('app_interaction_new')}?source_document_id={document_id}",
            'createTaskUrl': f"{reverse('app_interaction_new')}?type=todo&source_document_id={document_id}",
        }
