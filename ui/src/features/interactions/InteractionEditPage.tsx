import * as React from 'react';
import { Clock3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { fetchZones, type ZoneOption } from '@/lib/api/zones';
import { updateInteraction } from '@/lib/api/interactions';
import { useInteraction } from './hooks';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import ExpenseFields from './ExpenseFields';

const TYPE_OPTIONS = [
  'note',
  'todo',
  'expense',
  'maintenance',
  'repair',
  'installation',
  'inspection',
  'warranty',
  'issue',
  'upgrade',
  'replacement',
  'disposal',
];

const STATUS_OPTIONS = ['backlog', 'pending', 'in_progress', 'done', 'archived'];

function isoToDate(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoToTime(value: string): string {
  if (!value) return '12:00';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '12:00';
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function InteractionEditPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: interaction, isLoading, error } = useInteraction(id ?? '');

  const [subject, setSubject] = React.useState('');
  const [type, setType] = React.useState('note');
  const [status, setStatus] = React.useState('pending');
  const [occurredOn, setOccurredOn] = React.useState('');
  const [includeTime, setIncludeTime] = React.useState(false);
  const [occurredTime, setOccurredTime] = React.useState('12:00');
  const [description, setDescription] = React.useState('');
  const [tagsInput, setTagsInput] = React.useState('');
  const [zoneId, setZoneId] = React.useState('');
  const [zones, setZones] = React.useState<ZoneOption[]>([]);
  const [amount, setAmount] = React.useState('');
  const [supplier, setSupplier] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [initialised, setInitialised] = React.useState(false);
  const showSkeleton = useDelayedLoading(isLoading);

  const metadata = (interaction?.metadata ?? {}) as Record<string, string | null | undefined>;

  // Pre-fill form once interaction is loaded
  React.useEffect(() => {
    if (!interaction || initialised) return;
    setSubject(interaction.subject ?? '');
    setType(interaction.type ?? 'note');
    setStatus(interaction.status ?? 'pending');
    if (interaction.occurred_at) {
      setOccurredOn(isoToDate(interaction.occurred_at));
      setOccurredTime(isoToTime(interaction.occurred_at));
    }
    setDescription(interaction.content ?? '');
    setTagsInput((interaction.tags ?? []).join(', '));
    const md = (interaction.metadata ?? {}) as Record<string, string | null | undefined>;
    setAmount(md.amount ?? '');
    setSupplier(md.supplier ?? '');
    setInitialised(true);
  }, [interaction, initialised]);

  React.useEffect(() => {
    fetchZones()
      .then(setZones)
      .catch(() => {});
  }, []);

  const isTodo = type === 'todo';
  const isExpense = type === 'expense';

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    if (!subject.trim()) {
      setFormError(t('interactions.error_subject_required'));
      return;
    }

    if (!occurredOn) {
      setFormError(t('interactions.error_invalid_date'));
      return;
    }

    const resolvedTime = includeTime ? occurredTime || '12:00' : occurredTime || '12:00';
    const occurredAt = new Date(`${occurredOn}T${resolvedTime}`);
    if (Number.isNaN(occurredAt.getTime())) {
      setFormError(t('interactions.error_invalid_date'));
      return;
    }

    const tags = tagsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // Merge metadata for expense-specific fields, preserving any existing keys.
    let nextMetadata: Record<string, unknown> | undefined;
    if (isExpense) {
      const existing = (interaction?.metadata ?? {}) as Record<string, unknown>;
      const trimmedAmount = amount.trim();
      nextMetadata = {
        ...existing,
        amount: trimmedAmount ? trimmedAmount : null,
        supplier: supplier.trim(),
      };
    }

    try {
      setSubmitting(true);
      await updateInteraction(id ?? '', {
        subject: subject.trim(),
        content: description,
        type,
        status: isTodo ? status : null,
        occurred_at: occurredAt.toISOString(),
        zone_ids: zoneId ? [zoneId] : [],
        tags_input: tags,
        ...(nextMetadata ? { metadata: nextMetadata } : {}),
      });
      navigate(-1);
    } catch {
      setFormError(t('interactions.update_failed'));
    } finally {
      setSubmitting(false);
    }
  }

  if (showSkeleton) {
    return (
      <div className="mx-auto max-w-2xl space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    );
  }
  if (isLoading) return null;

  if (error || !interaction) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {t('interactions.update_failed')}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t('interactions.edit_title')}>
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(-1)}
          disabled={submitting}
        >
          {t('common.cancel')}
        </Button>
      </PageHeader>

      <form className="space-y-5" onSubmit={handleSubmit}>
        {/* Subject */}
        <div className="space-y-2">
          <label htmlFor="interaction-subject" className="text-sm font-medium">
            {t('interactions.subject_label')} <span className="text-rose-500">*</span>
          </label>
          <Input
            id="interaction-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t('interactions.subject_placeholder')}
            required
            autoFocus
          />
        </div>

        {/* Type + Status (when todo) */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="interaction-type" className="text-sm font-medium">
              {t('interactions.type_label')}
            </label>
            <select
              id="interaction-type"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {TYPE_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {t(`equipment.interaction_type.${v}`, { defaultValue: v })}
                </option>
              ))}
            </select>
          </div>

          {isTodo ? (
            <div className="space-y-2">
              <label htmlFor="interaction-status" className="text-sm font-medium">
                {t('interactions.status_label')}
              </label>
              <select
                id="interaction-status"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {STATUS_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {t(`equipment.interaction_status.${v}`, { defaultValue: v })}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        {isExpense ? (
          <ExpenseFields
            amount={amount}
            onAmountChange={setAmount}
            supplier={supplier}
            onSupplierChange={setSupplier}
            sourceLabel={interaction.source_label}
            sourceType={interaction.source_type}
            sourceId={interaction.source_id}
            kind={(metadata.kind ?? null) as string | null}
            unitPrice={(metadata.unit_price ?? null) as string | null}
            unit={(metadata.unit ?? null) as string | null}
          />
        ) : null}

        {/* Date / time */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="interaction-date" className="text-sm font-medium">
              {includeTime ? t('interactions.date_time_label') : t('interactions.date_only_label')}
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={includeTime}
              onClick={() => setIncludeTime((prev) => !prev)}
              className="h-auto gap-1 px-0 py-0 text-xs font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
            >
              <Clock3 className="h-3.5 w-3.5" />
              {includeTime ? t('interactions.time_label') : t('interactions.add_time_label')}
            </Button>
          </div>
          <div className={`grid gap-3 ${includeTime ? 'md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]' : ''}`}>
            <Input
              id="interaction-date"
              type="date"
              value={occurredOn}
              onChange={(e) => setOccurredOn(e.target.value)}
              required
            />
            {includeTime ? (
              <Input
                id="interaction-time"
                type="time"
                aria-label={t('interactions.time_label')}
                value={occurredTime}
                onChange={(e) => setOccurredTime(e.target.value)}
              />
            ) : null}
          </div>
        </div>

        {/* Zone */}
        <div className="space-y-2">
          <label htmlFor="interaction-zone" className="text-sm font-medium">
            {t('interactions.zone_label')}
          </label>
          <select
            id="interaction-zone"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
          >
            <option value="">{t('interactions.zone_placeholder')}</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.full_path ?? z.name}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label htmlFor="interaction-description" className="text-sm font-medium">
            {t('interactions.description_label')}
          </label>
          <Textarea
            id="interaction-description"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('interactions.description_placeholder')}
          />
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <label htmlFor="interaction-tags" className="text-sm font-medium">
            {t('interactions.tags_label')}
          </label>
          <Input
            id="interaction-tags"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder={t('interactions.tags_input_placeholder')}
          />
          <p className="text-xs text-muted-foreground">{t('interactions.tags_input_help')}</p>
        </div>

        {/* Error */}
        {formError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {formError}
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-border/60 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
            disabled={submitting}
          >
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? t('common.saving') : t('interactions.update_label')}
          </Button>
        </div>
      </form>
    </div>
  );
}
