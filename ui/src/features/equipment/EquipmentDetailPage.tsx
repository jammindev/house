import * as React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Wrench } from 'lucide-react';
import { Badge } from '@/design-system/badge';
import { Button } from '@/design-system/button';
import { Card, CardContent } from '@/design-system/card';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  useEquipment,
  useEquipmentHistory,
  useDeleteEquipment,
  equipmentKeys,
} from './hooks';
import EquipmentDialog from './EquipmentDialog';

// ── Helpers ────────────────────────────────────────────────

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'maintenance') return 'secondary';
  if (status === 'lost') return 'destructive';
  if (status === 'retired' || status === 'storage') return 'outline';
  return 'default';
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(d);
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

function isExpired(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function isOverdue(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

// ── Info field cell ────────────────────────────────────────

function InfoField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/60 p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-2 text-sm text-foreground">{children}</dd>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────

export default function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
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

  function handleDelete() {
    if (!id) return;
    deleteMutation.mutate(id, {
      onSuccess: () => navigate('/app/equipment'),
    });
  }

  if (!id) return null;

  if (isLoading && !equipment) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    );
  }

  if (error || !equipment) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {t('equipment.detail.errors.load_failed')}
        <Link to="/app/equipment" className="ml-2 underline hover:no-underline">
          {t('equipment.title')}
        </Link>
      </div>
    );
  }

  const warrantyExpired = isExpired(equipment.warranty_expires_on);
  const serviceOverdue = isOverdue(equipment.next_service_due);

  const logInteractionHref = [
    '/app/interactions/new?type=maintenance',
    equipment.zone ? `&zone_id=${equipment.zone}` : '',
    `&equipment_id=${equipment.id}`,
  ].join('');

  return (
    <>
      <div className="space-y-6">
        {/* Back */}
        <Link
          to="/app/equipment"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('equipment.title')}
        </Link>

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{equipment.name}</h1>
              <Badge variant={statusVariant(equipment.status)} className="text-xs">
                {t(`equipment.status.${equipment.status}`)}
              </Badge>
            </div>
            {equipment.zone && (
              <p className="mt-1 text-sm text-muted-foreground">
                <Link
                  to={`/app/zones/${equipment.zone}`}
                  className="hover:text-foreground hover:underline"
                >
                  {equipment.zone_name ?? equipment.zone}
                </Link>
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
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
          </div>
        </div>

        {/* Info grid */}
        <section className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60">
              <Wrench className="h-5 w-5 text-slate-600" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {t('equipment.detail.title')}
              </h2>
            </div>
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        </section>

        {/* Warranty block */}
        {(equipment.warranty_expires_on || equipment.warranty_provider) ? (
          <Card>
            <CardContent className="pt-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                {t('equipment.detail.fields.warranty')}
              </h3>
              <div className="space-y-2 text-sm">
                {equipment.warranty_expires_on ? (
                  <p className={warrantyExpired ? 'text-red-600' : 'text-green-600'}>
                    {warrantyExpired
                      ? t('equipment.detail.warranty_expired')
                      : t('equipment.detail.warranty_ok', {
                          date: formatDate(equipment.warranty_expires_on),
                        })}
                  </p>
                ) : null}
                {equipment.warranty_provider ? (
                  <p className="text-muted-foreground">
                    {t('equipment.form.fields.warranty_provider')}: {equipment.warranty_provider}
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Maintenance block */}
        {(equipment.last_service_at || equipment.next_service_due) ? (
          <Card>
            <CardContent className="pt-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                {t('equipment.detail.fields.next_service')}
              </h3>
              <div className="space-y-2 text-sm">
                {equipment.last_service_at ? (
                  <p className="text-muted-foreground">
                    {t('equipment.detail.fields.last_service')}: {formatDate(equipment.last_service_at)}
                  </p>
                ) : null}
                {equipment.next_service_due ? (
                  <p className={serviceOverdue ? 'text-red-600' : 'text-foreground'}>
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

        {/* Intervention history */}
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
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
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
