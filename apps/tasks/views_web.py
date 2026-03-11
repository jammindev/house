from core.views import ReactPageView


class AppTasksView(ReactPageView):
    react_root_id = "tasks-root"
    props_script_id = "tasks-props"
    page_vite_asset = "src/pages/tasks/list.tsx"
