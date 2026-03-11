from django.utils.translation import gettext_lazy as _

from core.views import ReactPageView


class AppPhotosView(ReactPageView):
    react_root_id = "photos-root"
    props_script_id = "photos-props"
    page_vite_asset = "src/pages/photos/list.tsx"
