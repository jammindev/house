import * as React from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileText, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/design-system/badge';
import { Button } from '@/design-system/button';
import { Card, CardContent } from '@/design-system/card';
import ConfirmDialog from '@/components/ConfirmDialog';
import BackLink from '@/components/BackLink';
import { pushBack, useNavigateBack } from '@/lib/backNavigation';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useInteraction, useDeleteInteraction } from './hooks';

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
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

export default function InteractionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const navigateBack = useNavigateBack('/app/interactions');

  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const { data: interaction, isLoading, error } = useInteraction(id ?? '');
  const deleteMutation = useDeleteInteraction();

  const showSkeleton = useDelayedLoading(isLoading);

  function handleDelete() {
    if (!id) return;
    deleteMutation.mutate(id, {
      onSuccess: () => navigateBack(),
    });
  }

  if (!id) return null;

  if (showSkeleton) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }
  if (isLoading) return null;

  if (error || !interaction) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {t('interactions.error_load_failed')}
        <Link to="/app/interactions" className="ml-2 underline hover:no-underline">
          {t('interactions.title')}
        </Link>
      </div>
    );
  }

  const metadata = (interaction.metadata ?? {}) as Record<string, string | null | undefined>;
  const amount = metadata.amount;
  const supplier = metadata.supplier;
  const isExpense = interaction.type === 'expense';

  return (
    <>
      <div className="space-y-6">
        {/* Back */}
        <BackLink fallback="/app/interactions" fallbackLabel={t('interactions.title')} />

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{interaction.subject}</h1>
              <Badge variant="outline">
                {t(`equipment.interaction_type.${interaction.type}`)}
              </Badge>
              {interaction.status ? (
                <Badge variant="secondary">
                  {t(`equipment.interaction_status.${interaction.status}`)}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDateTime(interaction.occurred_at)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-8 px-3 text-sm"
              onClick={() => navigate(`/app/interactions/${id}/edit`)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              {t('common.edit')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-8 px-3 text-sm"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {t('common.delete')}
            </Button>
          </div>
        </div>

        {/* Info grid */}
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoField label={t('interactions.date_label')}>
            {formatDateTime(interaction.occurred_at)}
          </InfoField>

          {interaction.zone_names.length > 0 && (
            <InfoField label={t('interactions.zone_label')}>
              {interaction.zone_names.join(', ')}
            </InfoField>
          )}

          {interaction.project && interaction.project_title && (
            <InfoField label={t('interactions.project_label')}>
              <Link
                to={`/app/projects/${interaction.project}`}
                state={pushBack(location)}
                className="text-primary hover:underline"
              >
                {interaction.project_title}
              </Link>
            </InfoField>
          )}

          {interaction.created_by_name && (
            <InfoField label={t('interactions.detail_created_by')}>
              {interaction.created_by_name}
            </InfoField>
          )}

          {isExpense && amount ? (
            <InfoField label={t('interactions.expense_amount_label')}>{amount} €</InfoField>
          ) : null}

          {isExpense && supplier ? (
            <InfoField label={t('interactions.contact_label')}>{supplier}</InfoField>
          ) : null}
        </dl>

        {/* Content */}
        <Card>
          <CardContent className="pt-4">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <FileText className="h-4 w-4 text-muted-foreground" />
              {t('interactions.description_label')}
            </h2>
            {interaction.content ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                {interaction.content}
              </p>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                {t('interactions.detail_no_content')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Tags */}
        {interaction.tags.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">{t('interactions.tags_label')}</h2>
            <div className="flex flex-wrap gap-1.5">
              {interaction.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Related entities */}
        {(interaction.contacts?.length ||
          interaction.structures?.length ||
          interaction.equipments?.length) ? (
          <div className="space-y-3">
            {interaction.equipments && interaction.equipments.length > 0 && (
              <div>
                <h2 className="mb-1.5 text-sm font-semibold text-foreground">
                  {t('interactions.equipment_label')}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {interaction.equipments.map((eq) => (
                    <Link
                      key={eq.id}
                      to={`/app/equipment/${eq.id}`}
                      state={pushBack(location)}
                      className="rounded-full border border-border px-2 py-0.5 text-xs text-foreground hover:text-primary hover:underline"
                    >
                      {eq.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {interaction.contacts && interaction.contacts.length > 0 && (
              <div>
                <h2 className="mb-1.5 text-sm font-semibold text-foreground">
                  {t('interactions.contact_label')}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {interaction.contacts.map((c) => (
                    <span
                      key={c.id}
                      className="rounded-full border border-border px-2 py-0.5 text-xs text-foreground"
                    >
                      {c.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {interaction.structures && interaction.structures.length > 0 && (
              <div>
                <h2 className="mb-1.5 text-sm font-semibold text-foreground">
                  {t('interactions.structure_label')}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {interaction.structures.map((s) => (
                    <span
                      key={s.id}
                      className="rounded-full border border-border px-2 py-0.5 text-xs text-foreground"
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('common.confirmDelete')}
        description={t('interactions.delete_confirm')}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
