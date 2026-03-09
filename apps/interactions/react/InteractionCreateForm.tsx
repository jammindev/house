import * as React from 'react';
import { Clock3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/design-system/alert';
import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { createInteraction } from '@/lib/api/interactions';
import { TagSelector } from '@/lib/components/TagSelector';
import { ZoneTreeSelector } from '@/lib/components/ZoneTreeSelector';
import type { ZoneOption } from '@/lib/api/zones';

import { useHouseholdId } from '@/lib/useHouseholdId';

interface InteractionCreateFormProps {
  title?: string;
  defaultType?: string;
  submitLabel?: string;
  successMessage?: string;
  initialZones?: ZoneOption[];
  initialZonesLoaded?: boolean;
  onCreated?: (interactionId: string) => void;
  redirectToListUrl?: string;
  linkedDocumentIds?: string[];
  redirectAfterSuccessUrl?: string;
  sourceDocument?: {
    id: string;
    name: string;
    type: string;
  } | null;
  redirectDelayMs?: number;
}

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

function translateInteractionType(t: ReturnType<typeof useTranslation>['t'], value: string): string {
  return t(`interaction_type.${value}`, { defaultValue: value });
}

function translateInteractionStatus(t: ReturnType<typeof useTranslation>['t'], value: string): string {
  return t(`interaction_status.${value}`, { defaultValue: value });
}

function todayLocalDateInput(): string {
  const now = new Date();
  const pad = (v: number) => String(v).padStart(2, '0');

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function nowLocalTimeInput(): string {
  const now = new Date();
  const pad = (v: number) => String(v).padStart(2, '0');

  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function buildOccurredAtValue(dateValue: string, includeTime: boolean, timeValue: string): string | null {
  if (!dateValue) {
    return null;
  }

  const resolvedTime = includeTime ? timeValue || '12:00' : '12:00';
  return `${dateValue}T${resolvedTime}`;
}

function buildRedirectUrl(baseUrl: string, createdId: string, createdParamName = 'created'): string {
  if (typeof window === 'undefined') {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}${createdParamName}=${encodeURIComponent(createdId)}`;
  }

  const url = new URL(baseUrl, window.location.origin);
  url.searchParams.set(createdParamName, createdId);

  return `${url.pathname}${url.search}${url.hash}`;
}

export function InteractionCreateForm({
  title: _title,
  defaultType = 'note',
  submitLabel,
  successMessage,
  initialZones = [],
  initialZonesLoaded = false,
  onCreated,
  redirectToListUrl,
  linkedDocumentIds = [],
  redirectAfterSuccessUrl,
  sourceDocument = null,
  redirectDelayMs = 800,
}: InteractionCreateFormProps) {
  const { t } = useTranslation();
  const householdId = useHouseholdId();
  const resolvedSubmitLabel = submitLabel ?? t('interactions.submit_label');
  const resolvedSuccessMessage = successMessage ?? t('interactions.success_message');

  const [subject, setSubject] = React.useState('');
  const [content, setContent] = React.useState('');
  const [type, setType] = React.useState(defaultType);
  const [status, setStatus] = React.useState('pending');
  const [expenseAmount, setExpenseAmount] = React.useState('');
  const [occurredOn, setOccurredOn] = React.useState(todayLocalDateInput());
  const [includeTime, setIncludeTime] = React.useState(false);
  const [occurredTime, setOccurredTime] = React.useState(nowLocalTimeInput());
  const [tagNames, setTagNames] = React.useState<string[]>([]);
  const [zoneIds, setZoneIds] = React.useState<string[]>([]);

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const isTodo = type === 'todo';
  const isExpense = type === 'expense';

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);
    setSuccess(null);

    if (!subject.trim()) {
      setError(t('interactions.error_subject_required'));
      return;
    }

    if (zoneIds.length === 0) {
      setError(t('interactions.error_zone_required'));
      return;
    }

    const occurredAt = buildOccurredAtValue(occurredOn, includeTime, occurredTime);
    if (!occurredAt) {
      setError(t('interactions.error_invalid_date'));
      return;
    }

    const occurredISO = new Date(occurredAt).toISOString();
    if (Number.isNaN(new Date(occurredISO).getTime())) {
      setError(t('interactions.error_invalid_date'));
      return;
    }

    let metadata: Record<string, unknown> = {};

    if (isExpense) {
      if (!expenseAmount.trim()) {
        setError(t('interactions.error_expense_amount_required'));
        return;
      }

      const parsedAmount = Number.parseFloat(expenseAmount.replace(',', '.'));
      if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
        setError(t('interactions.error_expense_amount_invalid'));
        return;
      }

      metadata = { amount: parsedAmount };
    }

    setSubmitting(true);

    try {
      const created = await createInteraction(
        {
          subject: subject.trim(),
          content,
          type,
          status: isTodo ? status : null,
          occurred_at: occurredISO,
          zone_ids: zoneIds,
          metadata,
          tags_input: tagNames,
          document_ids: linkedDocumentIds,
        },
        householdId
      );

      setSuccess(resolvedSuccessMessage);
      setSubject('');
      setContent('');
      setExpenseAmount('');
      setTagNames([]);
      setZoneIds([]);
      setStatus('pending');
      setOccurredOn(todayLocalDateInput());
      setIncludeTime(false);
      setOccurredTime(nowLocalTimeInput());

      if (onCreated) {
        onCreated(created.id);
      }

      if (redirectAfterSuccessUrl && typeof window !== 'undefined') {
        window.setTimeout(() => {
          window.location.assign(buildRedirectUrl(redirectAfterSuccessUrl, created.id, 'created_interaction'));
        }, redirectDelayMs);
      } else if (redirectToListUrl && typeof window !== 'undefined') {
        window.setTimeout(() => {
          window.location.assign(buildRedirectUrl(redirectToListUrl, created.id));
        }, redirectDelayMs);
      }
    } catch {
      setError(t('interactions.error_create_failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {sourceDocument ? (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <p className="text-sm font-medium text-foreground">{t('interactions.source_document_label')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {sourceDocument.name} · {t(`documents.type.${sourceDocument.type}`, { defaultValue: sourceDocument.type })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t('interactions.source_document_help')}</p>
        </div>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="interaction-subject" className="text-sm font-medium">
          {t('interactions.subject_label')}
        </label>
        <Input
          id="interaction-subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder={t('interactions.subject_placeholder')}
          required
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="interaction-type" className="text-sm font-medium">
            {t('interactions.type_label')}
          </label>
          <select
            id="interaction-type"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            {TYPE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {translateInteractionType(t, value)}
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
              onChange={(event) => setStatus(event.target.value)}
            >
              {STATUS_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {translateInteractionStatus(t, value)}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="interaction-occurred-on" className="text-sm font-medium">
            {includeTime ? t('interactions.date_time_label') : t('interactions.date_only_label')}
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={includeTime}
            onClick={() => setIncludeTime((current) => !current)}
            className="h-auto gap-1 px-0 py-0 text-xs font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
          >
            <Clock3 className="h-3.5 w-3.5" />
            {includeTime ? t('interactions.time_label') : t('interactions.add_time_label')}
          </Button>
        </div>

        <div className={`grid gap-3 ${includeTime ? 'md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]' : ''}`}>
          <Input
            id="interaction-occurred-on"
            type="date"
            value={occurredOn}
            onChange={(event) => setOccurredOn(event.target.value)}
            required
          />

          {includeTime ? (
            <Input
              id="interaction-occurred-time"
              type="time"
              aria-label={t('interactions.time_label')}
              value={occurredTime}
              onChange={(event) => setOccurredTime(event.target.value)}
            />
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="interaction-content" className="text-sm font-medium">
          {t('interactions.description_label')}
        </label>
        <Textarea
          id="interaction-content"
          rows={5}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={t('interactions.description_placeholder')}
        />
      </div>

      {isExpense ? (
        <div className="space-y-2">
          <label htmlFor="interaction-expense-amount" className="text-sm font-medium">
            {t('interactions.expense_amount_label')}
          </label>
          <Input
            id="interaction-expense-amount"
            inputMode="decimal"
            value={expenseAmount}
            onChange={(event) => setExpenseAmount(event.target.value)}
            placeholder={t('interactions.expense_amount_placeholder')}
          />
        </div>
      ) : null}

      <TagSelector
        householdId={householdId}
        tagType="interaction"
        selectedTagNames={tagNames}
        onChange={setTagNames}
        legend={t('interactions.tags_label')}
        placeholder={t('interactions.tags_placeholder')}
        helperText={t('interactions.tags_help')}
      />

      <ZoneTreeSelector
        householdId={householdId}
        selectedZoneIds={zoneIds}
        onChange={setZoneIds}
        initialZones={initialZones}
        initialZonesLoaded={initialZonesLoaded}
        storageKey="interaction-create-form:expanded-zones"
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{t('interactions.error_title')}</AlertTitle>
          <AlertDescription>
            <p>{error}</p>
          </AlertDescription>
        </Alert>
      ) : null}

      {success ? (
        <Alert>
          <AlertTitle>{t('interactions.success_title')}</AlertTitle>
          <AlertDescription>
            <p>{success}</p>
            {redirectAfterSuccessUrl || redirectToListUrl ? (
              <p className="mt-1 text-xs text-muted-foreground">{t('interactions.redirect_notice')}</p>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center justify-end border-t border-border/60 pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? t('interactions.creating') : resolvedSubmitLabel}
        </Button>
      </div>
    </form>
  );
}

export default InteractionCreateForm;
