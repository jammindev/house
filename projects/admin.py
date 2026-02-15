from django.contrib import admin

from .models import Project, ProjectGroup, ProjectZone, ProjectAIThread, ProjectAIMessage

admin.site.register(Project)
admin.site.register(ProjectGroup)
admin.site.register(ProjectZone)
admin.site.register(ProjectAIThread)
admin.site.register(ProjectAIMessage)
