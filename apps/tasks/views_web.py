from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import TemplateView


class AppTasksView(LoginRequiredMixin, TemplateView):
    template_name = 'tasks/app/tasks.html'

    def get_context_data(self, **kwargs):
        return super().get_context_data(react_props={}, **kwargs)
