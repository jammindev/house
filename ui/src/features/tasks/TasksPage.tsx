import * as React from 'react';
import { CheckSquare, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ListPage from '@/components/ListPage';
import { Button } from '@/design-system/button';
import TasksPanel from './TasksPanel';

export default function TasksPage() {
  const { t } = useTranslation();
  const [newTaskOpen, setNewTaskOpen] = React.useState(false);
  return (
    <ListPage
      title={t('tasks.title')}
      isEmpty={false}
      emptyState={{
        icon: CheckSquare,
        title: t('tasks.empty'),
        description: t('tasks.empty_description'),
      }}
      actions={
        <Button onClick={() => setNewTaskOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('tasks.new')}
        </Button>
      }
    >
      <TasksPanel
        stateKeyPrefix="tasks"
        newTaskOpen={newTaskOpen}
        onNewTaskOpenChange={setNewTaskOpen}
      />
    </ListPage>
  );
}
