from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import ListView, TemplateView


class ReactPageMixin:
    """
    Mixin that adds React hydration support to any Django CBV.

    Provides the class attributes, get_props() hook, and get_context_data()
    injection shared by ReactPageView and HouseholdListView.

    Rule: never override get_context_data() in subclasses — use
    get_props() for React data only.
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


class ReactPageView(ReactPageMixin, LoginRequiredMixin, TemplateView):
    """Base CBV for React pages that are not list views."""


class HouseholdListView(ReactPageMixin, LoginRequiredMixin, ListView):
    """
    Base CBV for React list pages scoped to a household.

    Inherits from ListView to use Django's standard get_queryset() /
    model / ordering hooks.  Subclasses set `model` and override
    get_queryset() (calling super()) for additional select_related /
    prefetch_related, then use self.object_list in get_props() for
    further filtering.

    self.selected_household is set by get_queryset() and is available
    in get_props().
    """

    def get_queryset(self):
        self.selected_household = self.request.household
        return (
            super().get_queryset()
            .for_user_households(self.request.user)
            .filter(household=self.selected_household)
        )
