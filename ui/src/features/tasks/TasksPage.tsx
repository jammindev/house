import { CheckSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ListPage from '@/components/ListPage';
import TasksPanel from './TasksPanel';

export default function TasksPage() {
  const { t } = useTranslation();
  return (
    <ListPage
      title={t('tasks.title')}
      isEmpty={false}
      emptyState={{
        icon: CheckSquare,
        title: t('tasks.empty'),
        description: t('tasks.empty_description'),
      }}
    >
      <TasksPanel stateKeyPrefix="tasks" />
    </ListPage>
  );
}
