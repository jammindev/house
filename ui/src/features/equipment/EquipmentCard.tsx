import { Link } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/design-system/badge';
import { Button } from '@/design-system/button';
import { CardTitle } from '@/design-system/card';
import CardActions, { type CardAction } from '@/components/CardActions';
import type { EquipmentListItem } from '@/lib/api/equipment';

interface EquipmentCardProps {
  item: EquipmentListItem;
  onEdit: (item: EquipmentListItem) => void;
  onDelete: (itemId: string) => void;
  onPurchase: (item: EquipmentListItem) => void;
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

export default function EquipmentCard({ item, onEdit, onDelete, onPurchase }: EquipmentCardProps) {
  const { t } = useTranslation();

  const actions: CardAction[] = [
    { label: t('common.edit'), icon: Pencil, onClick: () => onEdit(item) },
    { label: t('common.delete'), icon: Trash2, onClick: () => onDelete(item.id), variant: 'danger' },
  ];

  return (
    <li className="rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link
            to={`/app/equipment/${item.id}`}
            className="group text-foreground hover:text-primary"
          >
            <CardTitle className="text-inherit [&>span:last-child]:group-hover:underline">{item.name}</CardTitle>
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.category} · {item.manufacturer || t('equipment.unknown_maker')} {item.model || ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant(item.status)}>
            {t(`equipment.status.${item.status}`)}
          </Badge>
          <CardActions actions={actions} />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
        <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-3 sm:gap-x-4">
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPurchase(item)}
          className="h-7 gap-1 px-2 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('equipment.purchase.actions.add')}
        </Button>
      </div>
    </li>
  );
}
