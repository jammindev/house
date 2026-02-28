import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';

import TasksNode from './TasksNode';

type TasksProps = {
  section?: string;
};

onDomReady(() => {
  mountWithJsonScriptProps<TasksProps>('tasks-root', 'tasks-props', TasksNode, { withToaster: true });
});
