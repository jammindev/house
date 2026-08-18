import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, Pencil, Receipt, ShieldCheck, Trash2, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/design-system/badge';
import { Button } from '@/design-system/button';
import { Card, CardTitle } from '@/design-system/card';
import CardActions, { type CardAction } from '@/components/CardActions';
import { pushBack } from '@/lib/backNavigation';
import { cn } from '@/lib/utils';
import type { EquipmentListItem } from '@/lib/api/equipment';
import { statusVariant } from './format';
import { TONE_CLASS, categoryKey, healthWhen, isNoteworthy, maintenanceTone, warrantyTone } from './health';

interface EquipmentCardProps {
  item: EquipmentListItem;
  onEdit: (item: EquipmentListItem) => void;
  onDelete: (itemId: string) => void;
  onPurchase: (item: EquipmentListItem) => void;
  onLogService: (item: EquipmentListItem) => void;
  serviceInFlight?: boolean;
}

export default function EquipmentCard({
  item,
  onEdit,
  onDelete,
  onPurchase,
  onLogService,
  serviceInFlight = false,
}: EquipmentCardProps) {
  const { t } = useTranslation();
  const location = useLocation();

  const actions: CardAction[] = [
    { label: t('common.edit'), icon: Pencil, onClick: () => onEdit(item) },
    // L'achat descend ici : c'est le geste le plus rare du module, il occupait le
    // bouton le plus visible de chaque ligne.
    { label: t('equipment.purchase.actions.add'), icon: Receipt, onClick: () => onPurchase(item) },
    { label: t('common.delete'), icon: Trash2, onClick: () => onDelete(item.id), variant: 'danger' },
  ];

  const maintenance = item.maintenance_state;
  const warranty = item.warranty_state;
  // Un équipement suivi mérite son bouton même à jour — c'est le geste qu'on
  // vient faire. Un équipement sans intervalle déclaré n'a rien à cocher.
  const isTracked = maintenance.state !== 'unknown';
  const showMaintenance = isNoteworthy(maintenance.state);
  const showWarranty = isNoteworthy(warranty.state);

  return (
    <Card className="p-3">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Link
              to={`/app/equipment/${item.id}`}
              state={pushBack(location)}
              className="group text-foreground hover:text-primary"
            >
              <CardTitle className="text-inherit [&>span:last-child]:group-hover:underline">
                {item.name}
              </CardTitle>
            </Link>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {t(`equipment.category.${categoryKey(item.category)}`)}
              {item.manufacturer ? ` · ${item.manufacturer}` : ''}
              {item.model ? ` ${item.model}` : ''}
              {item.zone_name ? ` · ${item.zone_name}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {item.status !== 'active' ? (
              <Badge variant={statusVariant(item.status)} className="hidden sm:inline-flex">
                {t(`equipment.status.${item.status}`)}
              </Badge>
            ) : null}
            <CardActions actions={actions} />
          </div>
        </div>

        {/* La ligne de santé — ce que la carte existait pour ne pas dire — et,
            juste à côté, le geste qui l'éteint. Le signal et son remède sur la
            même ligne : c'est aussi ce qui garde le bouton loin du coin
            inférieur droit, où le lanceur flottant de l'agent le recouvrait.
            Rien ne s'affiche quand il n'y a rien à signaler : une carte qui
            répète « rien à signaler » cesse d'être lue. */}
        {showMaintenance || showWarranty || isTracked ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            {showMaintenance ? (
              <span className={cn('inline-flex items-center gap-1', TONE_CLASS[maintenanceTone(maintenance.state)])}>
                {maintenance.state === 'overdue' ? (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Wrench className="h-3.5 w-3.5 shrink-0" />
                )}
                {t(`equipment.health.maintenance.${maintenance.state}`, {
                  when: healthWhen(maintenance.days),
                })}
              </span>
            ) : null}
            {showWarranty ? (
              <span className={cn('inline-flex items-center gap-1', TONE_CLASS[warrantyTone(warranty.state)])}>
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                {t(`equipment.health.warranty.${warranty.state}`, {
                  when: healthWhen(warranty.days),
                })}
              </span>
            ) : null}
            {isTracked ? (
              <Button
                type="button"
                variant={maintenance.state === 'overdue' ? 'default' : 'outline'}
                size="sm"
                disabled={serviceInFlight}
                onClick={() => onLogService(item)}
                className="h-7 gap-1 px-2 text-xs"
              >
                <Wrench className="h-3.5 w-3.5" />
                {t('equipment.service.actions.log')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
