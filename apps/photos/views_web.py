from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import TemplateView


class AppPhotosView(LoginRequiredMixin, TemplateView):
    template_name = 'photos/app/photos.html'

    def get_context_data(self, **kwargs):
        return super().get_context_data(react_props={}, **kwargs)
