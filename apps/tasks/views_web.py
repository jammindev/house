from core.views import HouseholdListView
from interactions.models import Interaction
from tasks.serializers import TaskPropsSerializer


class AppTasksView(HouseholdListView):
    model = Interaction
    react_root_id = "tasks-root"
    props_script_id = "tasks-props"
    page_vite_asset = "src/pages/tasks/list.tsx"

    def get_queryset(self):
        return (
            super().get_queryset()
            .filter(type='todo')
            .exclude(status='archived')
            .select_related('created_by', 'project')
            .prefetch_related('zones', 'documents', 'interaction_documents', 'tags__tag')
            .order_by('occurred_at')
        )

    def get_props(self):
        tasks = self.object_list[:200]
        return {
            'initialTasks': TaskPropsSerializer(tasks, many=True).data,
        }
