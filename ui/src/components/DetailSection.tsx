import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

interface DetailSectionProps {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}

/**
 * Section-carte des pages de détail : icône ronde + titre, puis contenu.
 * Remplace le markup `rounded-2xl border … bg-card/70 …` recopié dans plusieurs pages.
 */
export default function DetailSection({ title, icon: Icon, children, className }: DetailSectionProps) {
  return (
    <section
      className={`rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm${className ? ` ${className}` : ''}`}
    >
      <div className="flex items-center gap-3">
        {Icon ? (
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </span>
        ) : null}
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}
