import * as React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/design-system/button';
import { Badge } from '@/design-system/badge';
import type { Structure } from '@/lib/api/structures';

interface StructureCardProps {
  structure: Structure;
  contactCount?: number;
  onEdit: (structure: Structure) => void;
  onDelete: (structureId: string) => void;
}

export default function StructureCard({
  structure,
  contactCount,
  onEdit,
  onDelete,
}: StructureCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-slate-900">{structure.name}</p>
            {structure.type ? (
              <Badge variant="secondary" className="text-[11px]">
                {structure.type}
              </Badge>
            ) : null}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {structure.website ? (
              <a
                href={structure.website}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {structure.website}
              </a>
            ) : null}
            {typeof contactCount === 'number' && contactCount > 0 ? (
              <span>{contactCount} contact{contactCount > 1 ? 's' : ''}</span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-rose-500"
            onClick={() => onDelete(structure.id)}
            aria-label="Supprimer"
            type="button"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-slate-600"
            onClick={() => onEdit(structure)}
            aria-label="Modifier"
            type="button"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
