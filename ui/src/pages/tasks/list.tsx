import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';
import TasksPage from '../../../../apps/tasks/react/TasksPage';
import { type Task } from '@/lib/api/tasks';

interface TasksPageProps {
  initialTasks?: Task[];
}

onDomReady(() => {
  mountWithJsonScriptProps<TasksPageProps>('tasks-root', 'tasks-props', TasksPage, { withToaster: true });
});
