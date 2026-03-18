import { type HouseholdMember, type Task, type TaskStatus } from '@/lib/api/tasks';
import { Badge } from '@/design-system/badge';
import TaskCard from './TaskCard';

interface SectionProps {
  title: string;
  tasks: Task[];
  householdMembers: HouseholdMember[];
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onAssigneeChange: (taskId: string, assignedToId: string | null) => Promise<void>;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  highlightHeader?: boolean;
}

export default function TaskSection({
  title,
  tasks,
  householdMembers,
  onStatusChange,
  onAssigneeChange,
  onEdit,
  onDelete,
  highlightHeader = false,
}: SectionProps) {
  if (tasks.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className={`flex w-full items-center justify-between rounded-md px-1 py-0.5 text-left text-sm font-semibold ${
        highlightHeader ? 'text-orange-700' : 'text-slate-700'
      }`}>
        <span className="flex items-center gap-2">
          {title}
          <Badge
            variant="secondary"
            className={highlightHeader ? 'border-orange-200 bg-orange-100 text-orange-700' : ''}
          >
            {tasks.length}
          </Badge>
        </span>
      </div>

      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            householdMembers={householdMembers}
            onStatusChange={onStatusChange}
            onAssigneeChange={onAssigneeChange}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
