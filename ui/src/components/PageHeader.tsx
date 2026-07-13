import * as React from 'react';
import { Separator } from '@/design-system/separator';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Action buttons rendered on the right side of the header */
  children?: React.ReactNode;
}

/**
 * Common page header rendered by React, replacing Django-rendered H1/description/actions.
 * Updates document.title automatically.
 */
export default function PageHeader({ title, description, children }: PageHeaderProps) {
  React.useEffect(() => {
    document.title = `${title} — House`;
  }, [title]);

  return (
    <div className="mb-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {children ? (
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{children}</div>
        ) : null}
      </div>
      <Separator />
    </div>
  );
}
