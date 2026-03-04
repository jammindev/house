from django.contrib import admin
from .models import Contact, Address, Email, Phone, Structure

admin.site.register(Contact)
admin.site.register(Structure)
admin.site.register(Address)
admin.site.register(Email)
admin.site.register(Phone)
