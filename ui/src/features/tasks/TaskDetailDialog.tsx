import { useTranslation } from 'react-i18next';
import { FileText, Lock, Paperclip, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/design-system/dialog';
import { Button } from '@/design-system/button';
import { useAuth } from '@/lib/auth/useAuth';
import type { HouseholdMember, Task, TaskStatus } from '@/lib/api/tasks';
import { isTaskOverdue, formatRelativeDate } from '@/lib/api/tasks';
import TaskStatusBadge from './TaskStatusBadge';
import TaskAssigneeBadge from './TaskAssigneeBadge';

interface TaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdMembers: HouseholdMember[];
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onAssigneeChange: (taskId: string, assignedToId: string | null) => Promise<void>;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onManageAttachments?: (task: Task) => void;
}

export default function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  householdMembers,
  onStatusChange,
  onAssigneeChange,
  onEdit,
  onDelete,
  onManageAttachments,
}: TaskDetailDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  if (!task) return null;

  const isCreator = user != null && String(task.created_by) === String(user.id);
  const isAssignee = user != null && task.assigned_to != null && String(task.assigned_to) === String(user.id);
  const canChangeStatus = isCreator || isAssignee;
  const showAssignee = householdMembers.length > 1 && !task.is_private;
  const overdue = isTaskOverdue(task);
  const relativeDate = formatRelativeDate(task.due_date);
  const zoneName = task.zone_names?.[0];
  const isHighPriority = task.priority === 1;
  const totalAttachments = (task.linked_document_count ?? 0) + (task.linked_interaction_count ?? 0);

  const handleEdit = () => {
    onOpenChange(false);
    onEdit(task);
  };

  const handleDelete = () => {
    onOpenChange(false);
    onDelete(task.id);
  };

  const handleManageAttachments = () => {
    onOpenChange(false);
    onManageAttachments?.(task);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6 text-base leading-snug">
            {isHighPriority && (
              <span className="mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-red-500 ring-2 ring-red-200" title={t('tasks.priorityHigh')} />
            )}
            {task.is_private && (
              <Lock className="h-4 w-4 flex-shrink-0 text-muted-foreground/50" />
            )}
            {task.subject || t('tasks.untitledTask')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-2">
            {zoneName && (
              <span className="text-sm font-medium text-foreground/80">{zoneName}</span>
            )}
            {relativeDate && (
              <>
                {zoneName && <span className="text-border">·</span>}
                <span className={`text-sm ${overdue ? 'font-medium text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`}>
                  {relativeDate}
                </span>
              </>
            )}
            {task.project_title && (
              <>
                <span className="text-border">·</span>
                <a
                  href={`/app/projects/${task.project}/`}
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                  onClick={() => onOpenChange(false)}
                >
                  {task.project_title}
                </a>
              </>
            )}
            <div className="flex items-center gap-1.5">
              {showAssignee && (
                <TaskAssigneeBadge
                  task={task}
                  members={householdMembers}
                  onChange={(assignedToId) => onAssigneeChange(task.id, assignedToId)}
                  disabled={!isCreator}
                />
              )}
              <TaskStatusBadge
                status={task.status}
                onChange={(newStatus) => onStatusChange(task.id, newStatus)}
                disabled={!canChangeStatus}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              {t('tasks.fieldContent')}
            </p>
            {task.content ? (
              <p className="whitespace-pre-line text-sm leading-relaxed">{task.content}</p>
            ) : (
              <p className="text-sm italic text-muted-foreground/60">{t('tasks.noNotes')}</p>
            )}
          </div>

          {/* Attachments */}
          {totalAttachments > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Paperclip className="h-3.5 w-3.5" />
              <span>
                {totalAttachments} {t('tasks.manageAttachments').toLowerCase()}
              </span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {isCreator && (
          <div className="flex items-center gap-2 border-t pt-4">
            <Button variant="outline" size="sm" onClick={handleEdit}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              {t('tasks.editTask')}
            </Button>
            {onManageAttachments && (
              <Button variant="outline" size="sm" onClick={handleManageAttachments}>
                <Paperclip className="mr-1.5 h-3.5 w-3.5" />
                {t('tasks.manageAttachments')}
              </Button>
            )}
            <Button variant="outline" size="sm" className="ml-auto text-red-600 hover:bg-red-50 hover:text-red-700" onClick={handleDelete}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {t('tasks.deleteTask')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
