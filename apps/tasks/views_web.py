from django.utils.translation import gettext_lazy as _

from core.views import ReactPageView


class AppTasksView(ReactPageView):
    page_title = _("Tasks")
    page_actions_template = "tasks/partials/_tasks_actions.html"
    react_root_id = "tasks-root"
    props_script_id = "tasks-props"
    page_vite_asset = "src/pages/tasks/list.tsx"
