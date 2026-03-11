from core.permissions import resolve_request_household
from core.views import ReactPageView
from interactions.models import Interaction
from tasks.serializers import TaskPropsSerializer


def _resolve_selected_household(request):
    selected_household = resolve_request_household(request, required=False)
    if selected_household:
        return selected_household
    membership = (
        request.user.householdmember_set
        .select_related('household')
        .order_by('household__name')
        .first()
    )
    return membership.household if membership else None


class AppTasksView(ReactPageView):
    react_root_id = "tasks-root"
    props_script_id = "tasks-props"
    page_vite_asset = "src/pages/tasks/list.tsx"

    def get_props(self):
        request = self.request
        selected_household = _resolve_selected_household(request)

        queryset = (
            Interaction.objects
            .for_user_households(request.user)
            .filter(type='todo')
            .exclude(status='archived')
            .select_related('created_by', 'project')
            .prefetch_related('zones', 'documents', 'interaction_documents', 'tags__tag')
            .order_by('occurred_at')
        )
        if selected_household:
            queryset = queryset.filter(household=selected_household)

        tasks = queryset[:200]
        initial_tasks = TaskPropsSerializer(tasks, many=True).data

        return {
            'initialTasks': initial_tasks,
        }
