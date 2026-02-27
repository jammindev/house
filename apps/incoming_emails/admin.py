from django.contrib import admin

from .models import IncomingEmail, IncomingEmailAttachment

admin.site.register(IncomingEmail)
admin.site.register(IncomingEmailAttachment)
