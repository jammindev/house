import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';
import TasksPage from '../../../../apps/tasks/react/TasksPage';

onDomReady(() => {
  mountWithJsonScriptProps('tasks-root', 'tasks-props', TasksPage, { withToaster: true });
});
