from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import ListView, TemplateView


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
    react_root_id  : str – id of the <div> React mounts into
    props_script_id: str – id of the <script> JSON tag
    page_vite_asset: str – Vite entry path, e.g. 'src/pages/projects.tsx'
    template_name  : str – override to use a custom template instead of
                           the generic core/react_page.html
    """

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
                "react_root_id": self.react_root_id,
                "props_script_id": self.props_script_id,
                "page_vite_asset": self.page_vite_asset,
                "react_props": self.get_props(),
            }
        )
        return ctx


class HouseholdListView(LoginRequiredMixin, ListView):
    """
    Base class for React list pages scoped to a household.

    Inherits from ListView to use Django's standard get_queryset() /
    model / ordering hooks.  Subclasses set `model` and override
    get_queryset() (calling super()) for additional select_related /
    prefetch_related, then use self.object_list in get_props() for
    further filtering.

    self.selected_household is set by get_queryset() and is available
    in get_props().

    Rule: never override get_context_data() in subclasses — use
    get_props() for React data only.
    """

    react_root_id: str = ""
    props_script_id: str = ""
    page_vite_asset: str = ""
    template_name: str = "core/react_page.html"

    def get_queryset(self):
        from core.permissions import resolve_selected_household

        self.selected_household = resolve_selected_household(self.request)
        return (
            super().get_queryset()
            .for_user_households(self.request.user)
            .filter(household=self.selected_household)
        )

    def get_props(self) -> dict:
        return {}

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(
            {
                "react_root_id": self.react_root_id,
                "props_script_id": self.props_script_id,
                "page_vite_asset": self.page_vite_asset,
                "react_props": self.get_props(),
            }
        )
        return ctx
