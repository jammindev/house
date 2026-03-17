import * as React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/design-system/button';
import { Badge } from '@/design-system/badge';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { Zone } from '@/lib/api/zones';
import { useDeleteZone } from './hooks';
import ZoneDialog from './ZoneDialog';

interface ZoneItemProps {
  zone: Zone;
  depth: number;
  onSaved: () => void;
}

export default function ZoneItem({ zone, depth, onSaved }: ZoneItemProps) {
  const { t } = useTranslation();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const deleteMutation = useDeleteZone();

  const indentPx = depth * 16;
  const displayColor = zone.color || '#94a3b8';
  const childCount = zone.children_count ?? 0;

  return (
    <>
      <div
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md"
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
          className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 hover:underline"
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
            className="h-7 w-7 text-slate-400 hover:text-slate-600"
            onClick={() => setEditOpen(true)}
            aria-label={t('common.edit')}
            type="button"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-rose-500"
            onClick={() => setDeleteOpen(true)}
            aria-label={t('common.delete')}
            type="button"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <ZoneDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        existingZone={zone}
        onSaved={() => {
          setEditOpen(false);
          onSaved();
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('common.confirmDelete')}
        description={t('zones.deleteConfirmDescription', { name: zone.name })}
        confirmLabel={t('common.delete')}
        onConfirm={() => {
          deleteMutation.mutate(zone.id);
          setDeleteOpen(false);
        }}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
