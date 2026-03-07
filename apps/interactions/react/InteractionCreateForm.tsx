import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/design-system/alert';
import { Button } from '@/design-system/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/design-system/card';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { createInteraction } from '@/lib/api/interactions';
import { fetchZones, type ZoneOption } from '@/lib/api/zones';

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

function nowLocalDateTimeInput(): string {
  const now = new Date();
  const pad = (v: number) => String(v).padStart(2, '0');

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function InteractionCreateForm({
  title,
  defaultType = 'note',
  submitLabel,
  successMessage,
  initialZones = [],
  initialZonesLoaded = false,
  onCreated,
  redirectToListUrl,
  redirectDelayMs = 800,
}: InteractionCreateFormProps) {
  const { t } = useTranslation();
  const householdId = useHouseholdId();
  const resolvedTitle = title ?? t('interactions.form_title');
  const resolvedSubmitLabel = submitLabel ?? t('interactions.submit_label');
  const resolvedSuccessMessage = successMessage ?? t('interactions.success_message');
  const [zones, setZones] = React.useState<ZoneOption[]>(initialZones);
  const [zonesLoading, setZonesLoading] = React.useState(!initialZonesLoaded);
  const [zonesError, setZonesError] = React.useState<string | null>(null);

  const [subject, setSubject] = React.useState('');
  const [content, setContent] = React.useState('');
  const [type, setType] = React.useState(defaultType);
  const [status, setStatus] = React.useState('pending');
  const [occurredAt, setOccurredAt] = React.useState(nowLocalDateTimeInput());
  const [tagsText, setTagsText] = React.useState('');
  const [zoneIds, setZoneIds] = React.useState<string[]>([]);

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (initialZonesLoaded) {
      return;
    }

    let isMounted = true;

    async function loadZones() {
      setZonesLoading(true);
      setZonesError(null);

      try {
        const data = await fetchZones(householdId);
        if (isMounted) setZones(data);
      } catch {
        if (isMounted) setZonesError(t('interactions.zones_error'));
      } finally {
        if (isMounted) setZonesLoading(false);
      }
    }

    loadZones();

    return () => {
      isMounted = false;
    };
  }, [householdId, initialZonesLoaded]);

  function toggleZone(zoneId: string) {
    setZoneIds((previous) =>
      previous.includes(zoneId)
        ? previous.filter((id) => id !== zoneId)
        : [...previous, zoneId]
    );
  }

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

    const occurredISO = new Date(occurredAt).toISOString();
    if (Number.isNaN(new Date(occurredISO).getTime())) {
      setError(t('interactions.error_invalid_date'));
      return;
    }

    setSubmitting(true);

    try {
      const created = await createInteraction(
        {
          subject: subject.trim(),
          content,
          type,
          status: type === 'todo' ? status : null,
          occurred_at: occurredISO,
          zone_ids: zoneIds,
          tags_input: tagsText
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
        },
        householdId
      );

      setSuccess(resolvedSuccessMessage);
      setSubject('');
      setContent('');
      setTagsText('');
      setZoneIds([]);
      setOccurredAt(nowLocalDateTimeInput());

      if (onCreated) {
        onCreated(created.id);
      }

      if (redirectToListUrl && typeof window !== 'undefined') {
        window.setTimeout(() => {
          window.location.assign(redirectToListUrl);
        }, redirectDelayMs);
      }
    } catch {
      setError(t('interactions.error_create_failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{resolvedTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
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
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="interaction-status" className="text-sm font-medium">
                {t('interactions.status_label')}
              </label>
              <select
                id="interaction-status"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                disabled={type !== 'todo'}
              >
                {STATUS_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="interaction-occurred-at" className="text-sm font-medium">
              {t('interactions.date_label')}
            </label>
            <Input
              id="interaction-occurred-at"
              type="datetime-local"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
              required
            />
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

          <div className="space-y-2">
            <label htmlFor="interaction-tags" className="text-sm font-medium">
              {t('interactions.tags_label')}
            </label>
            <Input
              id="interaction-tags"
              value={tagsText}
              onChange={(event) => setTagsText(event.target.value)}
              placeholder={t('interactions.tags_placeholder')}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('interactions.zones_legend')}</legend>

            {zonesLoading ? <p className="text-xs text-muted-foreground">{t('interactions.zones_loading')}</p> : null}
            {zonesError ? <p className="text-xs text-destructive">{zonesError}</p> : null}

            {!zonesLoading && !zonesError && zones.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('interactions.zones_empty')}</p>
            ) : null}

            {!zonesLoading && !zonesError && zones.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {zones.map((zone) => (
                  <label
                    key={zone.id}
                    className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={zoneIds.includes(zone.id)}
                      onChange={() => toggleZone(zone.id)}
                    />
                    <span>{zone.full_path || zone.name}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </fieldset>

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
                {redirectToListUrl ? (
                  <p className="mt-1 text-xs text-muted-foreground">{t('interactions.redirect_notice')}</p>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex items-center justify-end">
            <Button type="submit" disabled={submitting || zonesLoading}>
              {submitting ? t('interactions.creating') : resolvedSubmitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default InteractionCreateForm;
