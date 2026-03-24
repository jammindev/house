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
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
      </div>
      <Separator />
    </div>
  );
}
