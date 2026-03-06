from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.urls import reverse


@login_required
def app_contacts_view(request):
    initial_view = request.GET.get("view", "contacts")
    if initial_view not in ("contacts", "structures"):
        initial_view = "contacts"
    return render(
        request,
        'contacts/app/contacts.html',
        {
            'react_props': {
                'initialView': initial_view,
            },
        },
    )


@login_required
def app_contact_new_view(request):
    return render(
        request,
        'contacts/app/contact-new.html',
        {
            'react_props': {
                'redirectUrl': reverse('app_directory'),
            },
        },
    )


@login_required
def app_contact_detail_view(request, pk):
    return render(
        request,
        'contacts/app/contact-detail.html',
        {
            'react_props': {
                'contactId': str(pk),
                'editUrl': reverse('app_contact_edit', kwargs={'pk': pk}),
                'backUrl': reverse('app_directory'),
            },
        },
    )


@login_required
def app_contact_edit_view(request, pk):
    return render(
        request,
        'contacts/app/contact-edit.html',
        {
            'react_props': {
                'contactId': str(pk),
                'backUrl': reverse('app_contact_detail', kwargs={'pk': pk}),
            },
        },
    )


@login_required
def app_structure_new_view(request):
    return render(
        request,
        'contacts/app/structure-new.html',
        {
            'react_props': {
                'redirectUrl': f"{reverse('app_directory')}?view=structures",
            },
        },
    )


@login_required
def app_structure_detail_view(request, pk):
    return render(
        request,
        'contacts/app/structure-detail.html',
        {
            'react_props': {
                'structureId': str(pk),
                'editUrl': reverse('app_structure_edit', kwargs={'pk': pk}),
                'backUrl': f"{reverse('app_directory')}?view=structures",
            },
        },
    )


@login_required
def app_structure_edit_view(request, pk):
    return render(
        request,
        'contacts/app/structure-edit.html',
        {
            'react_props': {
                'structureId': str(pk),
                'backUrl': reverse('app_structure_detail', kwargs={'pk': pk}),
            },
        },
    )
