import * as React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/design-system/button';
import { Badge } from '@/design-system/badge';
import { Card } from '@/design-system/card';
import type { Zone } from '@/lib/api/zones';
import ZoneDialog from './ZoneDialog';

interface ZoneItemProps {
  zone: Zone;
  depth: number;
  onDelete: (zone: Zone) => void;
}

export default function ZoneItem({ zone, depth, onDelete }: ZoneItemProps) {
  const { t } = useTranslation();
  const [editOpen, setEditOpen] = React.useState(false);

  const indentPx = depth * 16;
  const displayColor = zone.color || '#94a3b8';
  const childCount = zone.children_count ?? 0;

  return (
    <>
      <Card
        className="flex items-center gap-2 px-3 py-2.5 transition-shadow hover:shadow-md"
        style={{ marginLeft: indentPx }}
      >
        {/* Color dot */}
        <span
          className="h-3 w-3 shrink-0 rounded-full border border-white shadow"
          style={{ backgroundColor: displayColor }}
        />

        {/* Name — clickable to detail */}
        <Link
          to={`/app/zones/${zone.id}`}
          className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:underline"
        >
          {zone.name}
        </Link>

        {/* Children badge */}
        {childCount > 0 ? (
          <Badge variant="secondary" className="shrink-0 text-xs">
            {childCount}
          </Badge>
        ) : null}

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setEditOpen(true)}
            aria-label={t('common.edit')}
            type="button"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(zone)}
            aria-label={t('common.delete')}
            type="button"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </Card>

      <ZoneDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        existing={zone}
      />
    </>
  );
}
