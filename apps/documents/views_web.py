from django.utils.translation import gettext_lazy as _

from core.views import ReactPageView


class AppDocumentsView(ReactPageView):
    page_title = _("Documents")
    react_root_id = "documents-root"
    props_script_id = "documents-props"
    page_vite_asset = "src/pages/documents/list.tsx"
