from django.contrib.auth.mixins import LoginRequiredMixin
from django.urls import reverse
from django.views.generic import TemplateView


class AppContactsView(LoginRequiredMixin, TemplateView):
    template_name = 'contacts/app/contacts.html'

    def get_context_data(self, **kwargs):
        initial_view = self.request.GET.get('view', 'contacts')
        if initial_view not in ('contacts', 'structures'):
            initial_view = 'contacts'
        return super().get_context_data(
            react_props={'initialView': initial_view},
            **kwargs,
        )


class AppContactNewView(LoginRequiredMixin, TemplateView):
    template_name = 'contacts/app/contact-new.html'

    def get_context_data(self, **kwargs):
        return super().get_context_data(
            react_props={'redirectUrl': reverse('app_directory')},
            **kwargs,
        )


class AppContactDetailView(LoginRequiredMixin, TemplateView):
    template_name = 'contacts/app/contact-detail.html'

    def get_context_data(self, **kwargs):
        pk = self.kwargs['pk']
        return super().get_context_data(
            react_props={
                'contactId': str(pk),
                'editUrl': reverse('app_contact_edit', kwargs={'pk': pk}),
                'backUrl': reverse('app_directory'),
            },
            **kwargs,
        )


class AppContactEditView(LoginRequiredMixin, TemplateView):
    template_name = 'contacts/app/contact-edit.html'

    def get_context_data(self, **kwargs):
        pk = self.kwargs['pk']
        return super().get_context_data(
            react_props={
                'contactId': str(pk),
                'backUrl': reverse('app_contact_detail', kwargs={'pk': pk}),
            },
            **kwargs,
        )


class AppStructureNewView(LoginRequiredMixin, TemplateView):
    template_name = 'contacts/app/structure-new.html'

    def get_context_data(self, **kwargs):
        return super().get_context_data(
            react_props={'redirectUrl': f"{reverse('app_directory')}?view=structures"},
            **kwargs,
        )


class AppStructureDetailView(LoginRequiredMixin, TemplateView):
    template_name = 'contacts/app/structure-detail.html'

    def get_context_data(self, **kwargs):
        pk = self.kwargs['pk']
        return super().get_context_data(
            react_props={
                'structureId': str(pk),
                'editUrl': reverse('app_structure_edit', kwargs={'pk': pk}),
                'backUrl': f"{reverse('app_directory')}?view=structures",
            },
            **kwargs,
        )


class AppStructureEditView(LoginRequiredMixin, TemplateView):
    template_name = 'contacts/app/structure-edit.html'

    def get_context_data(self, **kwargs):
        pk = self.kwargs['pk']
        return super().get_context_data(
            react_props={
                'structureId': str(pk),
                'backUrl': reverse('app_structure_detail', kwargs={'pk': pk}),
            },
            **kwargs,
        )
