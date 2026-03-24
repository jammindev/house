import * as React from 'react';
import { cn } from '@/lib/utils';

interface FilterPillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export const FilterPill = React.forwardRef<HTMLButtonElement, FilterPillProps>(
  ({ active = false, className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
FilterPill.displayName = 'FilterPill';
