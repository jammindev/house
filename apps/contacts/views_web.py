from django.contrib.auth.decorators import login_required
from django.shortcuts import render


@login_required
def app_contacts_view(request):
    return render(
        request,
        'contacts/app/contacts.html',
        {
            'section': 'contacts',
            'title': 'Directory',
            'description': 'Contacts directory is served by Django with an isolated mount node for interactive UI migration.',
            'mount_id': 'contacts-root',
            'react_props': {'section': 'contacts'},
        },
    )
