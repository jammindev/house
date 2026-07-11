import * as React from 'react';
import { Clock3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { fetchZones, type ZoneOption } from '@/lib/api/zones';
import { fetchContacts, type Contact } from '@/lib/api/contacts';
import { fetchStructures, type Structure } from '@/lib/api/structures';
import { fetchEquipmentList, type EquipmentListItem } from '@/lib/api/equipment';
import { useCreateInteraction } from './hooks';
import ExpenseFields from './ExpenseFields';

const TYPE_OPTIONS = [
  'note',
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

function todayDateInput(): string {
  const now = new Date();
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function nowTimeInput(): string {
  const now = new Date();
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export default function InteractionNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const createMutation = useCreateInteraction();

  // Read initial values from query params. 'todo' is no longer an interaction
  // type (todos live in the Task model) — old links fall back to 'note'.
  const requestedType = searchParams.get('type') ?? 'note';
  const rawParamType = TYPE_OPTIONS.includes(requestedType) ? requestedType : 'note';
  const paramZoneId = searchParams.get('zone_id') ?? '';
  const paramProjectId = searchParams.get('project_id') ?? '';
  const paramEquipmentId = searchParams.get('equipment_id') ?? '';
  const paramSourceInteractionId = searchParams.get('source_interaction_id') ?? '';

  // Une dépense liée à un projet passe exclusivement par le dialog d'achat
  // (ProjectPurchaseDialog, #235) — le form complet ne propose pas ce type
  // quand un projet est imposé via l'URL.
  const paramType = paramProjectId && rawParamType === 'expense' ? 'note' : rawParamType;
  const typeOptions = paramProjectId
    ? TYPE_OPTIONS.filter((v) => v !== 'expense')
    : TYPE_OPTIONS;

  const [subject, setSubject] = React.useState('');
  const [type, setType] = React.useState(paramType);
  const [occurredOn, setOccurredOn] = React.useState(todayDateInput);
  const [includeTime, setIncludeTime] = React.useState(false);
  const [occurredTime, setOccurredTime] = React.useState(nowTimeInput);
  const [description, setDescription] = React.useState('');
  const [tagsInput, setTagsInput] = React.useState('');
  const [zoneId, setZoneId] = React.useState(paramZoneId);
  const [zones, setZones] = React.useState<ZoneOption[]>([]);
  const [contactId, setContactId] = React.useState('');
  const [structureId, setStructureId] = React.useState('');
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [structures, setStructures] = React.useState<Structure[]>([]);
  const [equipmentId, setEquipmentId] = React.useState(paramEquipmentId);
  const [equipmentList, setEquipmentList] = React.useState<EquipmentListItem[]>([]);
  const [amount, setAmount] = React.useState('');
  const [supplier, setSupplier] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);

  const isExpense = type === 'expense';
  const zoneIsLocked = !!paramZoneId;

  React.useEffect(() => {
    fetchZones().then(setZones).catch(() => {});
    fetchContacts().then(setContacts).catch(() => {});
    fetchStructures().then(setStructures).catch(() => {});
    fetchEquipmentList().then(setEquipmentList).catch(() => {});
  }, []);

  // Pré-sélection de la racine si rien n'est imposé via le query param.
  React.useEffect(() => {
    if (zoneIsLocked || zoneId || !zones.length) return;
    const root = zones.find((z) => !z.parent);
    if (root) setZoneId(root.id);
  }, [zones, zoneId, zoneIsLocked]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    if (!subject.trim()) {
      setFormError(t('interactions.error_subject_required'));
      return;
    }

    if (!zoneId) {
      setFormError(t('interactions.error_zone_required'));
      return;
    }

    if (!occurredOn) {
      setFormError(t('interactions.error_invalid_date'));
      return;
    }

    const resolvedTime = includeTime ? occurredTime || '12:00' : '12:00';
    const occurredAt = new Date(`${occurredOn}T${resolvedTime}`);
    if (Number.isNaN(occurredAt.getTime())) {
      setFormError(t('interactions.error_invalid_date'));
      return;
    }

    const tags = tagsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // Build metadata: source_interaction (when relevant) + expense fields (when type=expense).
    let metadata: Record<string, unknown> | undefined;
    if (paramSourceInteractionId) {
      metadata = { source_interaction: paramSourceInteractionId };
    }
    if (isExpense) {
      const trimmedAmount = amount.trim();
      metadata = {
        ...(metadata ?? {}),
        kind: 'manual',
        source_name: null,
        amount: trimmedAmount ? trimmedAmount : null,
        unit_price: null,
        supplier: supplier.trim(),
      };
    }

    try {
      await createMutation.mutateAsync({
        subject: subject.trim(),
        content: description,
        type,
        occurred_at: occurredAt.toISOString(),
        zone_ids: [zoneId],
        tags_input: tags,
        ...(paramProjectId
          ? { source_type: 'projects.project', source_id: paramProjectId }
          : {}),
        contact_ids: contactId ? [contactId] : [],
        structure_ids: structureId ? [structureId] : [],
        equipment_ids: equipmentId ? [equipmentId] : [],
        ...(metadata ? { metadata } : {}),
      });

      if (paramEquipmentId) {
        navigate(`/app/equipment/${paramEquipmentId}`);
      } else if (paramProjectId) {
        navigate(`/app/projects/${paramProjectId}`);
      } else {
        navigate('/app/interactions');
      }
    } catch {
      setFormError(t('interactions.error_create_failed'));
    }
  }

  const submitting = createMutation.isPending;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t('interactions.new_title')}>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (paramEquipmentId) navigate(`/app/equipment/${paramEquipmentId}`);
            else if (paramProjectId) navigate(`/app/projects/${paramProjectId}`);
            else navigate('/app/interactions');
          }}
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

        {/* Type */}
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
              {typeOptions.map((v) => (
                <option key={v} value={v}>
                  {t(`equipment.interaction_type.${v}`, { defaultValue: v })}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isExpense ? (
          <ExpenseFields
            amount={amount}
            onAmountChange={setAmount}
            supplier={supplier}
            onSupplierChange={setSupplier}
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
            {t('interactions.zone_label')} <span className="text-rose-500">*</span>
          </label>
          {zoneIsLocked ? (
            <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
              {zones.find((z) => z.id === zoneId)?.full_path ??
                zones.find((z) => z.id === zoneId)?.name ??
                zoneId}
            </div>
          ) : (
            <select
              id="interaction-zone"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              required
            >
              <option value="">{t('interactions.zone_placeholder')}</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.full_path ?? z.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Contact + Structure */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="interaction-contact" className="text-sm font-medium">
              {t('interactions.contact_label')}
            </label>
            <select
              id="interaction-contact"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
            >
              <option value="">{t('interactions.contact_placeholder')}</option>
              {contacts.map((c) => {
                const name = `${c.first_name}${c.last_name ? ' ' + c.last_name : ''}`.trim() || c.id;
                return (
                  <option key={c.id} value={c.id}>
                    {name}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="interaction-structure" className="text-sm font-medium">
              {t('interactions.structure_label')}
            </label>
            <select
              id="interaction-structure"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={structureId}
              onChange={(e) => setStructureId(e.target.value)}
            >
              <option value="">{t('interactions.structure_placeholder')}</option>
              {structures.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Equipment */}
        <div className="space-y-2">
          <label htmlFor="interaction-equipment" className="text-sm font-medium">
            {t('interactions.equipment_label')}
          </label>
          {paramEquipmentId ? (
            <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
              {equipmentList.find((eq) => eq.id === equipmentId)?.name ?? equipmentId}
            </div>
          ) : (
            <select
              id="interaction-equipment"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
            >
              <option value="">{t('interactions.equipment_placeholder')}</option>
              {equipmentList.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.name}
                </option>
              ))}
            </select>
          )}
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
            onClick={() => {
              if (paramEquipmentId) navigate(`/app/equipment/${paramEquipmentId}`);
              else if (paramProjectId) navigate(`/app/projects/${paramProjectId}`);
              else navigate('/app/interactions');
            }}
            disabled={submitting}
          >
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? t('interactions.creating') : t('interactions.submit_label')}
          </Button>
        </div>
      </form>
    </div>
  );
}
