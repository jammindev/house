import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { DropdownSelect } from '@/design-system/dropdown-select';
import type { TaskStatus } from '@/lib/api/tasks';

const STATUSES: { value: TaskStatus; labelKey: string; className: string }[] = [
  { value: 'backlog',     labelKey: 'tasks.sections.backlog',     className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  { value: 'pending',     labelKey: 'tasks.sections.pending',     className: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  { value: 'in_progress', labelKey: 'tasks.sections.in_progress', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  { value: 'done',        labelKey: 'tasks.sections.done',        className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
];

function normalizeStatus(status: TaskStatus): string {
  return status ?? 'backlog';
}

interface TaskStatusBadgeProps {
  status: TaskStatus;
  onChange: (status: TaskStatus) => Promise<void>;
  disabled?: boolean;
}

export default function TaskStatusBadge({ status, onChange, disabled }: TaskStatusBadgeProps) {
  const { t } = useTranslation();
  const current = STATUSES.find((s) => s.value === normalizeStatus(status)) ?? STATUSES[0];

  const options = STATUSES.map((s) => ({
    value: s.value as string,
    label: t(s.labelKey),
  }));

  return (
    <DropdownSelect
      value={normalizeStatus(status)}
      options={options}
      onChange={(val) => onChange(val as TaskStatus)}
      disabled={disabled}
    >
      <button
        type="button"
        className={[
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-opacity',
          current.className,
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:opacity-80',
        ].join(' ')}
      >
        {t(current.labelKey)}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
    </DropdownSelect>
  );
}
