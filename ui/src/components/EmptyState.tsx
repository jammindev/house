import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/design-system/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}

export default function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('rounded-md border border-dashed border-border bg-card p-8 text-center', className)}>
      <Icon className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" aria-hidden />
      <p className="text-sm font-medium text-card-foreground">{title}</p>
      {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      {action ? (
        action.href ? (
          <a href={action.href} className={cn(buttonVariants({ size: 'sm' }), 'mt-4')}>
            {action.label}
          </a>
        ) : (
          <button type="button" onClick={action.onClick} className={cn(buttonVariants({ size: 'sm' }), 'mt-4')}>
            {action.label}
          </button>
        )
      ) : null}
    </div>
  );
}
