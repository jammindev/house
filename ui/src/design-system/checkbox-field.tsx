import * as React from 'react';
import { cn } from '@/lib/utils';

interface CheckboxFieldProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function CheckboxField({ id, label, checked, onChange, className }: CheckboxFieldProps) {
  return (
    <label
      htmlFor={id}
      className={cn('flex cursor-pointer items-center gap-2', className)}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 appearance-none rounded border border-slate-300 bg-transparent transition-colors checked:border-slate-800 checked:bg-slate-800 checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%2016%2016%22%20fill%3D%22white%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M12.207%204.793a1%201%200%20010%201.414l-5%205a1%201%200%2001-1.414%200l-2-2a1%201%200%20011.414-1.414L6.5%209.086l4.293-4.293a1%201%200%20011.414%200z%22%2F%3E%3C%2Fsvg%3E')] checked:bg-no-repeat checked:bg-center dark:border-slate-600"
      />
      <span className="text-sm text-foreground">{label}</span>
    </label>
  );
}
