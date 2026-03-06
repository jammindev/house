import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';
import TasksPage from './TasksPage';

type TasksPageProps = Record<string, never>;

onDomReady(() => {
  mountWithJsonScriptProps<TasksPageProps>('tasks-root', 'tasks-props', TasksPage, { withToaster: true });
});
