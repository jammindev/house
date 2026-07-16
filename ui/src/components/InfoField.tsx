import * as React from 'react';

interface InfoFieldProps {
  label: string;
  children: React.ReactNode;
}

/**
 * Cellule label/valeur (`<dt>`/`<dd>`) des grilles d'info des pages de détail.
 * À placer dans un `<dl>` (ex: `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`).
 */
export default function InfoField({ label, children }: InfoFieldProps) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/60 p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-2 text-sm text-foreground">{children}</dd>
    </div>
  );
}
