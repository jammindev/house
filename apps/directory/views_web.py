from django.urls import reverse
from django.utils.translation import gettext_lazy as _

from core.views import ReactPageView


class AppContactsView(ReactPageView):
    react_root_id = "directory-root"
    props_script_id = "directory-props"
    page_vite_asset = "src/pages/contacts/list.tsx"

    def get_props(self):
        initial_view = self.request.GET.get('view', 'contacts')
        if initial_view not in ('contacts', 'structures'):
            initial_view = 'contacts'
        return {'initialView': initial_view}


class AppContactNewView(ReactPageView):
    react_root_id = "contact-new-root"
    props_script_id = "contact-new-props"
    page_vite_asset = "src/pages/contacts/new.tsx"

    def get_props(self):
        return {'redirectUrl': reverse('app_directory')}


class AppContactDetailView(ReactPageView):
    react_root_id = "contact-detail-root"
    props_script_id = "contact-detail-props"
    page_vite_asset = "src/pages/contacts/detail.tsx"

    def get_props(self):
        pk = self.kwargs['pk']
        return {
            'contactId': str(pk),
            'editUrl': reverse('app_contact_edit', kwargs={'pk': pk}),
            'backUrl': reverse('app_directory'),
        }


class AppContactEditView(ReactPageView):
    react_root_id = "contact-edit-root"
    props_script_id = "contact-edit-props"
    page_vite_asset = "src/pages/contacts/edit.tsx"

    def get_props(self):
        pk = self.kwargs['pk']
        return {
            'contactId': str(pk),
            'backUrl': reverse('app_contact_detail', kwargs={'pk': pk}),
        }


class AppStructureNewView(ReactPageView):
    react_root_id = "structure-new-root"
    props_script_id = "structure-new-props"
    page_vite_asset = "src/pages/structures/new.tsx"

    def get_props(self):
        return {'redirectUrl': f"{reverse('app_directory')}?view=structures"}


class AppStructureDetailView(ReactPageView):
    react_root_id = "structure-detail-root"
    props_script_id = "structure-detail-props"
    page_vite_asset = "src/pages/structures/detail.tsx"

    def get_props(self):
        pk = self.kwargs['pk']
        return {
            'structureId': str(pk),
            'editUrl': reverse('app_structure_edit', kwargs={'pk': pk}),
            'backUrl': f"{reverse('app_directory')}?view=structures",
        }


class AppStructureEditView(ReactPageView):
    react_root_id = "structure-edit-root"
    props_script_id = "structure-edit-props"
    page_vite_asset = "src/pages/structures/edit.tsx"

    def get_props(self):
        pk = self.kwargs['pk']
        return {
            'structureId': str(pk),
            'backUrl': reverse('app_structure_detail', kwargs={'pk': pk}),
        }

