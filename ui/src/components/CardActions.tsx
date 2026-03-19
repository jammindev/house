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
          className={cn('h-7 w-7 text-slate-400 hover:text-slate-600', triggerClassName)}
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
              className={action.variant === 'danger' ? 'text-rose-600 hover:text-rose-700 focus:text-rose-700' : undefined}
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
