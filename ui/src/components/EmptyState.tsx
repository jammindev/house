import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/design-system/button';

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  /**
   * Second chemin, rendu en `outline` à côté du principal. À utiliser quand la
   * page a **deux** façons de sortir du vide (créer / rattacher l'existant) :
   * une barre d'actions masquée à vide, pour ne pas redire le CTA de l'encart,
   * emporte sinon le second avec elle — et le rend injoignable.
   */
  secondaryAction?: EmptyStateAction;
  className?: string;
}

function ActionButton({
  action,
  variant,
}: {
  action: EmptyStateAction;
  variant: 'default' | 'outline';
}) {
  const className = cn(buttonVariants({ size: 'sm', variant }));
  return action.href ? (
    <a href={action.href} className={className}>
      {action.label}
    </a>
  ) : (
    <button type="button" onClick={action.onClick} className={className}>
      {action.label}
    </button>
  );
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('rounded-md border border-dashed border-border bg-card p-8 text-center', className)}>
      <Icon className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" aria-hidden />
      <p className="text-sm font-medium text-card-foreground">{title}</p>
      {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      {action || secondaryAction ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action ? <ActionButton action={action} variant="default" /> : null}
          {secondaryAction ? <ActionButton action={secondaryAction} variant="outline" /> : null}
        </div>
      ) : null}
    </div>
  );
}
