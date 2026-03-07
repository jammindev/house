from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import TemplateView


class ReactPageView(LoginRequiredMixin, TemplateView):
    """
    Base class-based view for pages that mount a single React component.

    Subclasses declare page metadata as class attributes and override
    get_props() to return the initial props dict that will be serialised
    into a <script type="application/json"> tag and consumed by the React
    mount file.

    Rule: every piece of data needed by React at first render must be
    included in get_props() – no API fetch should happen on mount.

    Class attributes
    ----------------
    page_title       : str  – displayed in <title> and <h1>
    page_description : str  – optional subtitle / description paragraph
    react_root_id    : str  – id of the <div> React mounts into
    props_script_id  : str  – id of the <script> JSON tag
    page_vite_asset  : str  – Vite entry path, e.g. 'src/pages/projects.tsx'
    template_name    : str  – override to use a custom template instead of
                             the generic core/react_page.html
    """

    page_title: str = ""
    page_description: str = ""
    react_root_id: str = ""
    props_script_id: str = ""
    page_vite_asset: str = ""
    template_name: str = "core/react_page.html"

    def get_props(self) -> dict:
        """Return the props dict to hydrate the React component.

        Override in subclasses.  Every key/value here will be
        json_script-serialised and available to the mount file.
        """
        return {}

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(
            {
                "page_title": self.page_title,
                "page_description": self.page_description,
                "react_root_id": self.react_root_id,
                "props_script_id": self.props_script_id,
                "page_vite_asset": self.page_vite_asset,
                "react_props": self.get_props(),
            }
        )
        return ctx

