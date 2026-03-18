from django.contrib import admin

from .models import Task, TaskZone

admin.site.register(Task)
admin.site.register(TaskZone)
