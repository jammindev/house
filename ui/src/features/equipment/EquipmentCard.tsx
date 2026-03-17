import * as React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/design-system/badge';
import { Button } from '@/design-system/button';
import type { EquipmentListItem } from '@/lib/api/equipment';

interface EquipmentCardProps {
  item: EquipmentListItem;
  onEdit: (item: EquipmentListItem) => void;
  onDelete: (itemId: string) => void;
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'maintenance') return 'secondary';
  if (status === 'lost') return 'destructive';
  if (status === 'retired' || status === 'storage') return 'outline';
  return 'default';
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

export default function EquipmentCard({ item, onEdit, onDelete }: EquipmentCardProps) {
  const { t } = useTranslation();

  return (
    <li className="rounded-md border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-sm">{item.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.category} · {item.manufacturer || t('equipment.unknown_maker')} {item.model || ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant(item.status)}>
            {t(`equipment.status.${item.status}`)}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-slate-600"
            onClick={() => onEdit(item)}
            aria-label={t('common.edit')}
            type="button"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-rose-500"
            onClick={() => onDelete(item.id)}
            aria-label={t('common.delete')}
            type="button"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
        <p>
          {t('equipment.zone')}: {item.zone_name || t('equipment.not_available')}
        </p>
        <p>
          {t('equipment.warranty')}: {formatDate(item.warranty_expires_on)}
        </p>
        <p>
          {t('equipment.next_service')}: {formatDate(item.next_service_due)}
        </p>
      </div>
    </li>
  );
}
