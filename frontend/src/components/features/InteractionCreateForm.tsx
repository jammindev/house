import * as React from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createInteraction } from '@/lib/api/interactions';
import { fetchZones, type ZoneOption } from '@/lib/api/zones';

interface InteractionCreateFormProps {
  title?: string;
  householdId?: string;
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
  title = 'Create interaction',
  householdId,
  defaultType = 'note',
  submitLabel = 'Create interaction',
  successMessage = 'Interaction created successfully.',
  initialZones = [],
  initialZonesLoaded = false,
  onCreated,
  redirectToListUrl,
  redirectDelayMs = 800,
}: InteractionCreateFormProps) {
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
        if (isMounted) setZonesError('Unable to load zones.');
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
      setError('Subject is required.');
      return;
    }

    if (zoneIds.length === 0) {
      setError('Select at least one zone.');
      return;
    }

    const occurredISO = new Date(occurredAt).toISOString();
    if (Number.isNaN(new Date(occurredISO).getTime())) {
      setError('Invalid date.');
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
          tags: tagsText
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
        },
        householdId
      );

      setSuccess(successMessage);
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
      setError('Unable to create interaction. Please verify fields and household context.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="interaction-subject" className="text-sm font-medium">
              Subject
            </label>
            <Input
              id="interaction-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Short summary"
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="interaction-type" className="text-sm font-medium">
                Type
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
                Status (todo)
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
              Date and time
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
              Description
            </label>
            <Textarea
              id="interaction-content"
              rows={5}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Details"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="interaction-tags" className="text-sm font-medium">
              Tags (comma separated)
            </label>
            <Input
              id="interaction-tags"
              value={tagsText}
              onChange={(event) => setTagsText(event.target.value)}
              placeholder="urgent, boiler, invoice"
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Zones</legend>

            {zonesLoading ? <p className="text-xs text-muted-foreground">Loading zones…</p> : null}
            {zonesError ? <p className="text-xs text-destructive">{zonesError}</p> : null}

            {!zonesLoading && !zonesError && zones.length === 0 ? (
              <p className="text-xs text-muted-foreground">No zones available.</p>
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
              <AlertTitle>Creation error</AlertTitle>
              <AlertDescription>
                <p>{error}</p>
              </AlertDescription>
            </Alert>
          ) : null}

          {success ? (
            <Alert>
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>
                <p>{success}</p>
                {redirectToListUrl ? (
                  <p className="mt-1 text-xs text-muted-foreground">Redirecting to interactions…</p>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex items-center justify-end">
            <Button type="submit" disabled={submitting || zonesLoading}>
              {submitting ? 'Creating…' : submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default InteractionCreateForm;
