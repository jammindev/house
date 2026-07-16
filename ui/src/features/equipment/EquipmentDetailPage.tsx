import * as React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Wrench } from 'lucide-react';
import { Badge } from '@/design-system/badge';
import { Button } from '@/design-system/button';
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
import { formatDate, formatDateTime, isPast } from '@/lib/format';
import {
  useEquipment,
  useEquipmentHistory,
  useDeleteEquipment,
  equipmentKeys,
} from './hooks';
import { statusVariant } from './format';
import EquipmentDialog from './EquipmentDialog';
import EquipmentDocumentsTab from './EquipmentDocumentsTab';
import EntityAssistant from '@/features/agent/EntityAssistant';
import { useDelayedLoading } from '@/lib/useDelayedLoading';

type Tab = 'info' | 'history' | 'documents' | 'assistant';
const TABS: Tab[] = ['info', 'history', 'documents', 'assistant'];

export default function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigateBack = useNavigateBack('/app/equipment');
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const { data: equipment, isLoading, error } = useEquipment(id ?? '');
  const { data: history = [], isLoading: historyLoading } = useEquipmentHistory(id ?? '');
  const deleteMutation = useDeleteEquipment();

  const handleSaved = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: equipmentKeys.all });
    setEditOpen(false);
  }, [qc]);

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

  const warrantyExpired = isPast(equipment.warranty_expires_on);
  const serviceOverdue = isPast(equipment.next_service_due);

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
                  <DetailSection title={t('equipment.detail.title')} icon={Wrench}>
                    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <InfoField label={t('equipment.detail.fields.category')}>
                        {equipment.category || '—'}
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
                        {equipment.condition || '—'}
                      </InfoField>

                      <InfoField label={t('equipment.detail.fields.purchase_date')}>
                        {formatDate(equipment.purchase_date)}
                      </InfoField>

                      {equipment.purchase_price != null ? (
                        <InfoField label={t('equipment.form.fields.purchase_price')}>
                          {Number(equipment.purchase_price).toFixed(2)} €
                        </InfoField>
                      ) : null}
                    </dl>
                  </DetailSection>

                  {(equipment.warranty_expires_on || equipment.warranty_provider) ? (
                    <Card>
                      <CardContent className="pt-4">
                        <h3 className="mb-3 text-sm font-semibold text-foreground">
                          {t('equipment.detail.fields.warranty')}
                        </h3>
                        <div className="space-y-2 text-sm">
                          {equipment.warranty_expires_on ? (
                            <p className={warrantyExpired ? 'text-destructive' : 'text-foreground'}>
                              {warrantyExpired
                                ? t('equipment.detail.warranty_expired')
                                : t('equipment.detail.warranty_ok', {
                                    date: formatDate(equipment.warranty_expires_on),
                                  })}
                            </p>
                          ) : null}
                          {equipment.warranty_provider ? (
                            <p className="text-muted-foreground">
                              {t('equipment.form.fields.warranty_provider')}:{' '}
                              {equipment.warranty_provider}
                            </p>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}

                  {(equipment.last_service_at || equipment.next_service_due) ? (
                    <Card>
                      <CardContent className="pt-4">
                        <h3 className="mb-3 text-sm font-semibold text-foreground">
                          {t('equipment.detail.fields.next_service')}
                        </h3>
                        <div className="space-y-2 text-sm">
                          {equipment.last_service_at ? (
                            <p className="text-muted-foreground">
                              {t('equipment.detail.fields.last_service')}:{' '}
                              {formatDate(equipment.last_service_at)}
                            </p>
                          ) : null}
                          {equipment.next_service_due ? (
                            <p className={serviceOverdue ? 'text-destructive' : 'text-foreground'}>
                              {serviceOverdue
                                ? t('equipment.detail.maintenance_overdue', {
                                    date: formatDate(equipment.next_service_due),
                                  })
                                : t('equipment.detail.maintenance_due', {
                                    date: formatDate(equipment.next_service_due),
                                  })}
                            </p>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              ) : null}

              {tab === 'history' ? (
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-foreground">
                      {t('equipment.detail.history_title')}
                    </h2>
                    <Link
                      to={logInteractionHref}
                      className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
                    >
                      {t('equipment.detail.add_intervention')}
                    </Link>
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
                        <li key={item.interaction} className="rounded-md border p-3 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium">{item.interaction_subject || '—'}</span>
                            <div className="flex shrink-0 gap-1">
                              {item.interaction_type ? (
                                <Badge variant="outline" className="h-5 text-[10px]">
                                  {t(`equipment.interaction_type.${item.interaction_type}`, {
                                    defaultValue: item.interaction_type,
                                  })}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                          {item.interaction_occurred_at ? (
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {formatDateTime(item.interaction_occurred_at)}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : null}

              {tab === 'documents' ? (
                <EquipmentDocumentsTab equipmentId={equipment.id} />
              ) : null}

              {tab === 'assistant' ? (
                <EntityAssistant entityType="equipment" objectId={equipment.id} />
              ) : null}
            </>
          )}
        </TabShell>
      </div>

      <EquipmentDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        existingItem={equipment}
        onSaved={handleSaved}
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
