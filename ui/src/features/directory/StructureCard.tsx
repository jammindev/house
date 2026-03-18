import { Pencil, Trash2 } from 'lucide-react';
import { Card } from '@/design-system/card';
import { Badge } from '@/design-system/badge';
import CardActions, { type CardAction } from '@/components/CardActions';
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
  const actions: CardAction[] = [
    { label: 'Modifier', icon: Pencil, onClick: () => onEdit(structure) },
    { label: 'Supprimer', icon: Trash2, onClick: () => onDelete(structure.id), variant: 'danger' },
  ];

  return (
    <Card className="p-3 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">{structure.name}</p>
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

        <CardActions actions={actions} />
      </div>
    </Card>
  );
}
