import * as React from 'react';
import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/design-system/dropdown-menu';
import { Button } from '@/design-system/button';
import { cn } from '@/lib/utils';

export interface CardAction {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

interface CardActionsProps {
  actions: CardAction[];
  triggerClassName?: string;
}

export default function CardActions({ actions, triggerClassName }: CardActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          // Tokens, pas `slate` : sur une vignette photo claire le gris fixe
          // devenait invisible, et le thème sombre affichait un gris clair sur
          // fond sombre. `text-muted-foreground` suit le thème dans les deux sens.
          className={cn('h-7 w-7 text-muted-foreground hover:text-foreground', triggerClassName)}
          type="button"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <DropdownMenuItem
              key={action.label}
              onClick={action.onClick}
              className={
                action.variant === 'danger'
                  ? 'text-destructive focus:text-destructive'
                  : undefined
              }
            >
              <Icon className="h-4 w-4" />
              {action.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
