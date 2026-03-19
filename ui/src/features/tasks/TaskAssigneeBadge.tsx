import { useTranslation } from 'react-i18next';
import { User, UserPlus } from 'lucide-react';
import { DropdownSelect } from '@/design-system/dropdown-select';
import type { HouseholdMember, Task } from '@/lib/api/tasks';

const UNASSIGNED = '';

interface TaskAssigneeBadgeProps {
  task: Task;
  members: HouseholdMember[];
  onChange: (assignedToId: string | null) => Promise<void>;
  disabled?: boolean;
}

export default function TaskAssigneeBadge({
  task,
  members,
  onChange,
  disabled,
}: TaskAssigneeBadgeProps) {
  const { t } = useTranslation();

  const isAssigned = Boolean(task.assigned_to);
  const displayName = members.find((m) => String(m.userId) === String(task.assigned_to))?.name
    ?? task.assigned_to_name
    ?? '';

  const options = [
    { value: UNASSIGNED, label: t('tasks.noAssignee') },
    ...members.map((m) => ({ value: m.userId, label: m.name })),
  ];

  const handleChange = (val: string) => onChange(val === UNASSIGNED ? null : val);

  return (
    <DropdownSelect
      value={task.assigned_to ?? UNASSIGNED}
      options={options}
      onChange={handleChange}
      disabled={disabled}
    >
      {isAssigned ? (
        <button
          type="button"
          className={[
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
            'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:opacity-80',
          ].join(' ')}
        >
          <User className="h-3 w-3" />
          {displayName}
        </button>
      ) : (
        <button
          type="button"
          className={[
            'inline-flex items-center gap-1 text-[11px] text-muted-foreground/50 transition-colors',
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:text-muted-foreground',
          ].join(' ')}
        >
          <UserPlus className="h-3 w-3" />
          {t('tasks.assign')}
        </button>
      )}
    </DropdownSelect>
  );
}
