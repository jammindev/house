from django.contrib import admin
from .models import Contact, Address, Email, Phone

admin.site.register(Contact)
admin.site.register(Address)
admin.site.register(Email)
admin.site.register(Phone)
