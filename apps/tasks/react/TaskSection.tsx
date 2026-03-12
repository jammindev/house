import * as React from 'react';
import { } from 'lucide-react';
import { type Task, type TaskStatus } from '@/lib/api/tasks';
import TaskCard from './TaskCard';

interface SectionProps {
  title: string;
  tasks: Task[];
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onEdit: (task: Task) => void;
  
  highlightHeader?: boolean;
}

export default function TaskSection({ title, tasks, onStatusChange, onEdit, highlightHeader = false }: SectionProps) {

  if (tasks.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className={`flex w-full items-center justify-between rounded-md px-1 py-0.5 text-left text-sm font-semibold ${
        highlightHeader ? 'text-orange-700' : 'text-slate-700'
      }`}>
        <span>
          {title}
          <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${highlightHeader ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>
            {tasks.length}
          </span>
        </span>
      </div>

      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onStatusChange={onStatusChange}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  );
}
