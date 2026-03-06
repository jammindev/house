from django.contrib.auth.decorators import login_required
from django.shortcuts import render


@login_required
def app_tasks_view(request):
    return render(request, 'tasks/app/tasks.html', {'react_props': {}})
