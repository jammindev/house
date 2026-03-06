import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/design-system/alert';
import { Badge } from '@/design-system/badge';
import { Button } from '@/design-system/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/design-system/card';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { createInteraction } from '@/lib/api/interactions';
import {
  deleteEquipment,
  fetchEquipment,
  fetchEquipmentAudit,
  fetchEquipmentInteractions,
  linkEquipmentInteraction,
  type EquipmentAudit,
  type EquipmentInteractionItem,
  type EquipmentListItem,
} from '@/lib/api/equipment';
import type { ZoneOption } from '@/lib/api/zones';

import { useHouseholdId } from '@/lib/useHouseholdId';

interface EquipmentDetailProps {
  title?: string;
  equipmentId: string;
  initialZones?: ZoneOption[];
  editUrl?: string;
  listUrl?: string;
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function formatDateTime(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function EquipmentDetail({
  title,
  equipmentId,
  initialZones = [],
  editUrl,
  listUrl = '/app/equipment/',
}: EquipmentDetailProps) {
  const householdId = useHouseholdId();
  const { t } = useTranslation();
  const [equipment, setEquipment] = React.useState<EquipmentListItem | null>(null);
  const [audit, setAudit] = React.useState<EquipmentAudit | null>(null);
  const [links, setLinks] = React.useState<EquipmentInteractionItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [submittingInteraction, setSubmittingInteraction] = React.useState(false);
  const [interactionError, setInteractionError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const [subject, setSubject] = React.useState('');
  const [content, setContent] = React.useState('');
  const [occurredAt, setOccurredAt] = React.useState(toDateTimeLocalValue(new Date()));
  const [type, setType] = React.useState('maintenance');
  const [status, setStatus] = React.useState('done');
  const [role, setRole] = React.useState('maintenance');
  const [note, setNote] = React.useState('');
  const [zoneId, setZoneId] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [item, itemAudit, itemLinks] = await Promise.all([
        fetchEquipment(equipmentId, householdId),
        fetchEquipmentAudit(equipmentId, householdId),
        fetchEquipmentInteractions(equipmentId, householdId),
      ]);
      setEquipment(item);
      setAudit(itemAudit);
      setLinks(itemLinks);
      if (item.zone) {
        setZoneId(item.zone);
      }
    } catch {
      setError(t('equipment.detail.errors.load_failed'));
    } finally {
      setLoading(false);
    }
  }, [equipmentId, householdId, t]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function handleCreateInteraction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setInteractionError(null);

    if (!subject.trim()) {
      setInteractionError(t('equipment.detail.interaction.errors.subject_required'));
      return;
    }

    if (!zoneId) {
      setInteractionError(t('equipment.detail.interaction.errors.zone_required'));
      return;
    }

    const parsedDate = new Date(occurredAt);
    if (Number.isNaN(parsedDate.getTime())) {
      setInteractionError(t('equipment.detail.interaction.errors.invalid_occurrence_date'));
      return;
    }

    setSubmittingInteraction(true);
    try {
      const created = await createInteraction(
        {
          subject: subject.trim(),
          content: content.trim(),
          type,
          status,
          occurred_at: parsedDate.toISOString(),
          zone_ids: [zoneId],
          tags: [],
        },
        householdId
      );

      await linkEquipmentInteraction(
        equipmentId,
        created.id,
        {
          role,
          note,
        },
        householdId
      );

      setSubject('');
      setContent('');
      setRole('maintenance');
      setNote('');
      setOccurredAt(toDateTimeLocalValue(new Date()));
      await load();
    } catch {
      setInteractionError(t('equipment.detail.interaction.errors.create_and_link_failed'));
    } finally {
      setSubmittingInteraction(false);
    }
  }

  async function handleDelete() {
    if (!equipment) return;
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(t('equipment.detail.confirm_delete', { name: equipment.name }));
      if (!confirmed) return;
    }

    setDeleting(true);
    try {
      await deleteEquipment(equipment.id, householdId);
      if (typeof window !== 'undefined') {
        window.location.assign(listUrl);
      }
    } catch {
      setError(t('equipment.detail.errors.delete_failed'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {loading ? <p className="text-sm text-muted-foreground">{t('equipment.loading')}</p> : null}

      {!loading && error ? (
        <Alert variant="destructive">
          <AlertTitle>{t('equipment.error_title')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!loading && !error && equipment ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{title ?? t('equipment.detail.title')}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{equipment.name}</p>
                </div>
                <Badge>{t(`equipment.status.${equipment.status}`)}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <p><span className="font-medium">{t('equipment.detail.fields.category')}:</span> {equipment.category}</p>
                <p><span className="font-medium">{t('equipment.detail.fields.zone')}:</span> {equipment.zone_name || t('equipment.not_available')}</p>
                <p><span className="font-medium">{t('equipment.detail.fields.manufacturer')}:</span> {equipment.manufacturer || t('equipment.not_available')}</p>
                <p><span className="font-medium">{t('equipment.detail.fields.model')}:</span> {equipment.model || t('equipment.not_available')}</p>
                <p><span className="font-medium">{t('equipment.detail.fields.serial_number')}:</span> {equipment.serial_number || t('equipment.not_available')}</p>
                <p><span className="font-medium">{t('equipment.detail.fields.condition')}:</span> {equipment.condition || t('equipment.not_available')}</p>
                <p><span className="font-medium">{t('equipment.detail.fields.purchase_date')}:</span> {formatDate(equipment.purchase_date) || t('equipment.not_available')}</p>
                <p><span className="font-medium">{t('equipment.detail.fields.warranty')}:</span> {formatDate(equipment.warranty_expires_on) || t('equipment.not_available')}</p>
                <p><span className="font-medium">{t('equipment.detail.fields.last_service')}:</span> {formatDate(equipment.last_service_at) || t('equipment.not_available')}</p>
                <p><span className="font-medium">{t('equipment.detail.fields.next_service')}:</span> {formatDate(equipment.next_service_due) || t('equipment.not_available')}</p>
              </div>

              <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
                <p><span className="font-medium">{t('equipment.detail.fields.created_by')}:</span> {audit?.created_by?.full_name || audit?.created_by?.email || t('equipment.not_available')}</p>
                <p><span className="font-medium">{t('equipment.detail.fields.updated_by')}:</span> {audit?.updated_by?.full_name || audit?.updated_by?.email || t('equipment.not_available')}</p>
              </div>

              {equipment.notes ? <p className="mt-3 text-sm text-muted-foreground">{equipment.notes}</p> : null}

              <div className="mt-4 flex items-center gap-2">
                <a
                  href={editUrl || `/app/equipment/${equipment.id}/edit/`}
                  className="inline-flex h-10 items-center rounded-md border border-input px-4 text-sm"
                >
                  {t('equipment.detail.actions.edit')}
                </a>
                <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? t('equipment.detail.actions.deleting') : t('equipment.detail.actions.delete')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('equipment.detail.interaction.linked_title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {links.length === 0 ? <p className="text-sm text-muted-foreground">{t('equipment.detail.interaction.empty')}</p> : null}
              {links.length > 0 ? (
                <ul className="space-y-2">
                  {links.map((link) => (
                    <li key={link.interaction} className="rounded-md border p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{link.interaction_subject || link.interaction}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{link.interaction_type ? t(`equipment.interaction_type.${link.interaction_type}`) : t('equipment.not_available')}</span>
                          <span>{link.role || t('equipment.detail.interaction.default_role')}</span>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{t('equipment.detail.interaction.occurred_at')}: {formatDateTime(link.interaction_occurred_at) || t('equipment.not_available')}</p>
                      {link.note ? <p className="mt-1 text-xs text-muted-foreground">{link.note}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('equipment.detail.interaction.create_title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={handleCreateInteraction}>
                <div className="space-y-1">
                  <label htmlFor="eq-int-subject" className="text-sm font-medium">{t('equipment.detail.interaction.fields.subject')}</label>
                  <Input id="eq-int-subject" value={subject} onChange={(event) => setSubject(event.target.value)} required />
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <label htmlFor="eq-int-type" className="text-sm font-medium">{t('equipment.detail.interaction.fields.type')}</label>
                    <select
                      id="eq-int-type"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={type}
                      onChange={(event) => setType(event.target.value)}
                    >
                      {['maintenance', 'repair', 'inspection', 'installation', 'issue', 'warranty', 'replacement', 'upgrade', 'disposal', 'expense'].map((entry) => (
                        <option key={entry} value={entry}>{t(`equipment.interaction_type.${entry}`)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="eq-int-status" className="text-sm font-medium">{t('equipment.detail.interaction.fields.status')}</label>
                    <select
                      id="eq-int-status"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={status}
                      onChange={(event) => setStatus(event.target.value)}
                    >
                      {['backlog', 'pending', 'in_progress', 'done', 'archived'].map((entry) => (
                        <option key={entry} value={entry}>{t(`equipment.interaction_status.${entry}`)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="eq-int-date" className="text-sm font-medium">{t('equipment.detail.interaction.fields.occurred_at')}</label>
                    <Input id="eq-int-date" type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} required />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label htmlFor="eq-int-zone" className="text-sm font-medium">{t('equipment.detail.interaction.fields.zone')}</label>
                    <select
                      id="eq-int-zone"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={zoneId}
                      onChange={(event) => setZoneId(event.target.value)}
                      required
                    >
                      <option value="">{t('equipment.detail.interaction.fields.select_zone')}</option>
                      {initialZones.map((entry) => (
                        <option key={entry.id} value={entry.id}>{entry.full_path || entry.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="eq-int-role" className="text-sm font-medium">{t('equipment.detail.interaction.fields.role')}</label>
                    <Input id="eq-int-role" value={role} onChange={(event) => setRole(event.target.value)} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="eq-int-content" className="text-sm font-medium">{t('equipment.detail.interaction.fields.content')}</label>
                  <Textarea id="eq-int-content" rows={3} value={content} onChange={(event) => setContent(event.target.value)} />
                </div>

                <div className="space-y-1">
                  <label htmlFor="eq-int-note" className="text-sm font-medium">{t('equipment.detail.interaction.fields.note')}</label>
                  <Textarea id="eq-int-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
                </div>

                {interactionError ? (
                  <Alert variant="destructive">
                    <AlertTitle>{t('equipment.detail.interaction.error_title')}</AlertTitle>
                    <AlertDescription>{interactionError}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="flex items-center justify-end">
                  <Button type="submit" disabled={submittingInteraction}>
                    {submittingInteraction ? t('equipment.detail.interaction.actions.creating') : t('equipment.detail.interaction.actions.create_and_link')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
