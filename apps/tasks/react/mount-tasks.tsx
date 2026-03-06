import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';
import TasksPage from './TasksPage';

type TasksPageProps = {
  householdId?: string | null;
};

onDomReady(() => {
  mountWithJsonScriptProps<TasksPageProps>('tasks-root', 'tasks-props', TasksPage, { withToaster: true });
});
