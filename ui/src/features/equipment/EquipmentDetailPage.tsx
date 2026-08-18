import * as React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Receipt, ShieldCheck, Wrench } from 'lucide-react';
import { Badge } from '@/design-system/badge';
import { Button, buttonVariants } from '@/design-system/button';
import { Card, CardContent } from '@/design-system/card';
import ConfirmDialog from '@/components/ConfirmDialog';
import BackLink from '@/components/BackLink';
import PageHeader from '@/components/PageHeader';
import DetailSection from '@/components/DetailSection';
import InfoField from '@/components/InfoField';
import LoadError from '@/components/LoadError';
import ListSkeleton from '@/components/ListSkeleton';
import { TabShell } from '@/components/TabShell';
import { useNavigateBack } from '@/lib/backNavigation';
import { formatAmount, formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  useEquipment,
  useEquipmentHistory,
  useDeleteEquipment,
  useLogEquipmentService,
} from './hooks';
import { statusVariant } from './format';
import { TONE_CLASS, categoryKey, conditionKey, healthWhen, maintenanceTone, warrantyTone } from './health';
import EquipmentDialog from './EquipmentDialog';
import EquipmentPurchaseDialog from './EquipmentPurchaseDialog';
import EntityDocumentsTab from '@/features/documents/EntityDocumentsTab';
import EntityPhotosTab from '@/features/photos/EntityPhotosTab';
import { useDelayedLoading } from '@/lib/useDelayedLoading';

type Tab = 'info' | 'history' | 'documents' | 'photos';
const TABS: Tab[] = ['info', 'history', 'documents', 'photos'];

export default function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigateBack = useNavigateBack('/app/equipment');

  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [purchaseOpen, setPurchaseOpen] = React.useState(false);

  const { data: equipment, isLoading, error } = useEquipment(id ?? '');
  const { data: history = [], isLoading: historyLoading } = useEquipmentHistory(id ?? '');
  const deleteMutation = useDeleteEquipment();
  const logServiceMutation = useLogEquipmentService();

  const showSkeleton = useDelayedLoading(isLoading && !equipment);

  function handleDelete() {
    if (!id) return;
    deleteMutation.mutate(id, {
      onSuccess: () => navigateBack(),
    });
  }

  if (!id) return null;

  if (showSkeleton) {
    return <ListSkeleton className="space-y-2 p-4" />;
  }
  if (isLoading && !equipment) return null;

  if (error || !equipment) {
    return (
      <LoadError
        message={t('equipment.detail.errors.load_failed')}
        link={{ to: '/app/equipment', label: t('equipment.title') }}
      />
    );
  }

  const warranty = equipment.warranty_state;
  const maintenance = equipment.maintenance_state;
  const isTracked = maintenance.state !== 'unknown';

  const logInteractionHref = [
    '/app/interactions/new?type=maintenance',
    equipment.zone ? `&zone_id=${equipment.zone}` : '',
    `&equipment_id=${equipment.id}`,
  ].join('');

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          backLink={<BackLink fallback="/app/equipment" fallbackLabel={t('equipment.title')} />}
          title={equipment.name}
          titleSuffix={
            <Badge variant={statusVariant(equipment.status)} className="text-xs">
              {t(`equipment.status.${equipment.status}`)}
            </Badge>
          }
          description={
            equipment.zone ? (
              <Link
                to={`/app/zones/${equipment.zone}`}
                className="hover:text-foreground hover:underline"
              >
                {equipment.zone_name ?? equipment.zone}
              </Link>
            ) : undefined
          }
        >
          {/* Le geste courant d'abord, la gestion de la fiche ensuite. */}
          {isTracked ? (
            <Button
              type="button"
              variant={maintenance.state === 'overdue' ? 'default' : 'outline'}
              className="h-8 gap-1 px-3 text-sm"
              disabled={logServiceMutation.isPending}
              onClick={() => logServiceMutation.mutate({ id: equipment.id })}
            >
              <Wrench className="h-3.5 w-3.5" />
              {t('equipment.service.actions.log')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="h-8 px-3 text-sm"
            onClick={() => setEditOpen(true)}
          >
            {t('equipment.detail.actions.edit')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-8 px-3 text-sm"
            onClick={() => setDeleteOpen(true)}
          >
            {t('equipment.detail.actions.delete')}
          </Button>
        </PageHeader>

        {/* Tabs */}
        <TabShell<Tab>
          tabs={TABS.map((tab) => ({ key: tab, label: t(`equipment.tabs.${tab}`) }))}
          sessionKey={`equipment-detail.${equipment.id}.tab`}
          defaultTab="info"
        >
          {(tab) => (
            <>
              {tab === 'info' ? (
                <div className="space-y-6">
                  {/* Les deux verdicts en tête, dans les mots exacts de la liste :
                      ils viennent du même champ servi par le serveur et passent
                      par le même module de rendu. C'est ce qui les empêche de se
                      contredire d'un écran à l'autre. */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Card>
                      <CardContent className="flex items-start gap-3 pt-4">
                        <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-foreground">
                            {t('equipment.detail.fields.next_service')}
                          </h3>
                          <p className={cn('mt-1 text-sm', TONE_CLASS[maintenanceTone(maintenance.state)])}>
                            {t(`equipment.health.maintenance.${maintenance.state}`, {
                              when: healthWhen(maintenance.days),
                            })}
                          </p>
                          {maintenance.date ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {t('equipment.detail.maintenance_on', {
                                date: formatDate(maintenance.date),
                              })}
                            </p>
                          ) : null}
                          {equipment.last_service_at ? (
                            <p className="text-xs text-muted-foreground">
                              {t('equipment.detail.fields.last_service')}:{' '}
                              {formatDate(equipment.last_service_at)}
                            </p>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="flex items-start gap-3 pt-4">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-foreground">
                            {t('equipment.detail.fields.warranty')}
                          </h3>
                          <p className={cn('mt-1 text-sm', TONE_CLASS[warrantyTone(warranty.state)])}>
                            {t(`equipment.health.warranty.${warranty.state}`, {
                              when: healthWhen(warranty.days),
                            })}
                          </p>
                          {warranty.date ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {t('equipment.detail.warranty_on', {
                                date: formatDate(warranty.date),
                              })}
                            </p>
                          ) : null}
                          {equipment.warranty_provider ? (
                            <p className="text-xs text-muted-foreground">
                              {equipment.warranty_provider}
                            </p>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <DetailSection title={t('equipment.detail.title')} icon={Wrench}>
                    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <InfoField label={t('equipment.detail.fields.category')}>
                        {t(`equipment.category.${categoryKey(equipment.category)}`)}
                      </InfoField>

                      <InfoField label={t('equipment.detail.fields.zone')}>
                        {equipment.zone ? (
                          <Link
                            to={`/app/zones/${equipment.zone}`}
                            className="hover:text-foreground hover:underline"
                          >
                            {equipment.zone_name ?? equipment.zone}
                          </Link>
                        ) : (
                          t('equipment.no_zone')
                        )}
                      </InfoField>

                      <InfoField label={t('equipment.detail.fields.manufacturer')}>
                        {equipment.manufacturer || '—'}
                      </InfoField>

                      <InfoField label={t('equipment.detail.fields.model')}>
                        {equipment.model || '—'}
                      </InfoField>

                      <InfoField label={t('equipment.detail.fields.serial_number')}>
                        {equipment.serial_number || '—'}
                      </InfoField>

                      <InfoField label={t('equipment.detail.fields.condition')}>
                        {equipment.condition ? t(`equipment.condition.${conditionKey(equipment.condition)}`) : '—'}
                      </InfoField>

                      <InfoField label={t('equipment.detail.fields.purchase_date')}>
                        {formatDate(equipment.purchase_date)}
                      </InfoField>

                      {equipment.purchase_price != null ? (
                        <InfoField label={t('equipment.form.fields.purchase_price')}>
                          {formatAmount(equipment.purchase_price)}
                        </InfoField>
                      ) : null}
                    </dl>
                  </DetailSection>

                  {equipment.notes ? (
                    <Card>
                      <CardContent className="pt-4">
                        <h3 className="mb-2 text-sm font-semibold text-foreground">
                          {t('equipment.form.fields.notes')}
                        </h3>
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                          {equipment.notes}
                        </p>
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              ) : null}

              {tab === 'history' ? (
                <section className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-foreground">
                      {t('equipment.detail.history_title')}
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => setPurchaseOpen(true)}
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        {t('equipment.purchase.actions.add')}
                      </Button>
                      <Link
                        to={logInteractionHref}
                        className={buttonVariants({ variant: 'outline', size: 'sm' })}
                      >
                        {t('equipment.detail.add_intervention')}
                      </Link>
                    </div>
                  </div>

                  {historyLoading ? (
                    <ListSkeleton rows={3} rowClassName="h-12" />
                  ) : history.length === 0 ? (
                    <p className="text-sm italic text-muted-foreground">
                      {t('equipment.detail.no_history')}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {history.map((item) => (
                        <li key={item.id} className="rounded-md border border-border p-3 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <span className="min-w-0 font-medium">{item.subject || '—'}</span>
                            <div className="flex shrink-0 items-center gap-2">
                              {item.amount ? (
                                <span className="text-xs font-medium text-foreground">
                                  {formatAmount(item.amount)}
                                </span>
                              ) : null}
                              {item.type ? (
                                <Badge variant="outline" className="h-5 text-[10px]">
                                  {t(`equipment.interaction_type.${item.type}`)}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                          {item.occurred_at ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatDateTime(item.occurred_at)}
                              {item.supplier ? ` · ${item.supplier}` : ''}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : null}

              {tab === 'documents' ? (
                <EntityDocumentsTab entityType="equipment" objectId={equipment.id} />
              ) : null}

              {tab === 'photos' ? (
                <EntityPhotosTab entityType="equipment" objectId={equipment.id} />
              ) : null}
            </>
          )}
        </TabShell>
      </div>

      <EquipmentDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        existingItem={equipment}
        onSaved={() => setEditOpen(false)}
      />

      <EquipmentPurchaseDialog
        open={purchaseOpen}
        onOpenChange={setPurchaseOpen}
        equipment={equipment}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('common.confirmDelete')}
        description={t('equipment.detail.confirm_delete', { name: equipment.name })}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
