from django.contrib import admin

from .models import Project, ProjectGroup, ProjectZone

admin.site.register(Project)
admin.site.register(ProjectGroup)
admin.site.register(ProjectZone)
