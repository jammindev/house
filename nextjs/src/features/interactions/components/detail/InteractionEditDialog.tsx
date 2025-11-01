// nextjs/src/features/interactions/components/detail/InteractionEditDialog.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ToastProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import ContactSelector from "@interactions/components/ContactSelector";
import StructureSelector from "@interactions/components/StructureSelector";
import InteractionTagsSelector from "@interactions/components/InteractionTagsSelector";
import { INTERACTION_STATUSES, INTERACTION_TYPES } from "@interactions/constants";
import { toIsoStringFromInput, toLocalDateTimeInput } from "@interactions/utils/datetime";
import { useUpdateInteraction } from "@interactions/hooks/useUpdateInteraction";
import type { Interaction, InteractionStatus, InteractionType } from "@interactions/types";
import { extractAmountFromMetadata, formatAmountForInput, parseAmountInput } from "@interactions/utils/amount";
import { useContacts } from "@contacts/hooks/useContacts";
import { useStructures } from "@structures/hooks/useStructures";
import type { Contact } from "@contacts/types";
import type { Structure } from "@structures/types";
import type { ProjectStatus } from "@projects/types";

type InteractionEditDialogProps = {
  interaction: Interaction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

type ContactLike = Contact | Interaction["contacts"][number] | undefined;
type StructureLike = Structure | Interaction["structures"][number] | undefined;

const formatContactDisplayName = (contact?: ContactLike) => {
  if (!contact) return "";
  const first = contact.first_name?.trim() ?? "";
  const last = contact.last_name?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  if (full) return full;
  return contact.structure?.name?.trim() ?? "";
};

const formatStructureDisplayName = (structure?: StructureLike) => structure?.name?.trim() ?? "";

const AUTO_SUBJECT_TYPES = new Set<InteractionType>(["quote", "artisan_visit"]);

type ProjectOption = {
  id: string;
  title: string;
  status: ProjectStatus;
};

export default function InteractionEditDialog({ interaction, open, onOpenChange, onSaved }: InteractionEditDialogProps) {
  const { t } = useI18n();
  const { show } = useToast();
  const { updateInteraction, loading, error, setError } = useUpdateInteraction();
  const { contacts } = useContacts();
  const { structures } = useStructures();

  const [subject, setSubject] = useState(interaction.subject);
  const [subjectDirty, setSubjectDirty] = useState(false);
  const [type, setType] = useState<InteractionType>(interaction.type);
  const [status, setStatus] = useState<InteractionStatus | "">(interaction.status ?? "");
  const [occurredAt, setOccurredAt] = useState<string>(toLocalDateTimeInput(interaction.occurred_at));
  const [tagIds, setTagIds] = useState<string[]>(interaction.tags.map((tag) => tag.id));
  const [contactIds, setContactIds] = useState<string[]>(interaction.contacts.map((contact) => contact.id));
  const [structureIds, setStructureIds] = useState<string[]>(interaction.structures.map((structure) => structure.id));
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    interaction.project?.id ?? interaction.project_id ?? null
  );
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [formError, setFormError] = useState("");
  const [quoteAmount, setQuoteAmount] = useState(() =>
    interaction.type === "quote" ? formatAmountForInput(extractAmountFromMetadata(interaction.metadata)) : ""
  );

  useEffect(() => {
    if (!open) return;
    let active = true;
    const loadProjects = async () => {
      setProjectLoading(true);
      setProjectError("");
      try {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();
        const { data, error: loadError } = await client
          .from("projects")
          .select("id, title, status")
          .eq("household_id", interaction.household_id)
          .order("updated_at", { ascending: false })
          .limit(100);
        if (loadError) throw loadError;
        if (!active) return;
        setProjectOptions(
          (data ?? []).map(
            (row) =>
              ({
                id: row.id,
                title: row.title,
                status: row.status as ProjectStatus,
              }) satisfies ProjectOption
          )
        );
      } catch (loadErr) {
        if (!active) return;
        const message = loadErr instanceof Error ? loadErr.message : t("common.unexpectedError");
        setProjectError(message);
        setProjectOptions([]);
      } finally {
        if (active) setProjectLoading(false);
      }
    };
    void loadProjects();
    return () => {
      active = false;
    };
  }, [interaction.household_id, open, t]);

  const primaryStructureName = useMemo(() => {
    if (!structureIds.length) return null;
    const targetId = structureIds[0];
    const match = structures.find((item) => item.id === targetId);
    const formatted = formatStructureDisplayName(match);
    if (formatted) return formatted;
    const fallback = interaction.structures.find((item) => item.id === targetId);
    const fallbackFormatted = formatStructureDisplayName(fallback);
    return fallbackFormatted || null;
  }, [interaction.structures, structureIds, structures]);

  const primaryContactName = useMemo(() => {
    if (!contactIds.length) return null;
    const targetId = contactIds[0];
    const match = contacts.find((item) => item.id === targetId);
    const formatted = formatContactDisplayName(match);
    if (formatted) return formatted;
    const fallback = interaction.contacts.find((item) => item.id === targetId);
    const fallbackFormatted = formatContactDisplayName(fallback);
    return fallbackFormatted || null;
  }, [contactIds, contacts, interaction.contacts]);

  const projectOptionsWithFallback = useMemo(() => {
    if (!selectedProjectId) return projectOptions;
    const hasSelected = projectOptions.some((option) => option.id === selectedProjectId);
    if (hasSelected) return projectOptions;
    if (interaction.project && interaction.project.id === selectedProjectId) {
      const fallback: ProjectOption = {
        id: interaction.project.id,
        title: interaction.project.title,
        status: interaction.project.status,
      };
      return [...projectOptions, fallback];
    }
    return projectOptions;
  }, [interaction.project, projectOptions, selectedProjectId]);

  const selectedProjectName = useMemo(() => {
    if (!selectedProjectId) return null;
    const option = projectOptionsWithFallback.find((item) => item.id === selectedProjectId);
    const optionTitle = option?.title?.trim();
    if (optionTitle) return optionTitle;
    return null;
  }, [projectOptionsWithFallback, selectedProjectId]);

  const autoSubject = useMemo(() => {
    if (type === "quote") {
      const entityName = primaryStructureName ?? primaryContactName;
      if (!entityName || !selectedProjectName) return null;
      return t("interactionsquoteAutoSubject", {
        project: selectedProjectName,
        entity: entityName,
      });
    }
    if (type === "artisan_visit") {
      const base = t("interactionsartisanVisitBaseSubject");
      const entityName = primaryStructureName ?? primaryContactName;
      if (selectedProjectName && entityName) {
        return t("interactionsartisanVisitAutoSubjectWithProject", {
          project: selectedProjectName,
          entity: entityName,
        });
      }
      if (selectedProjectName && !entityName) {
        return t("interactionsartisanVisitAutoSubjectProjectOnly", { project: selectedProjectName });
      }
      if (entityName) {
        return t("interactionsartisanVisitAutoSubject", { entity: entityName });
      }
      return base;
    }
    return null;
  }, [primaryContactName, primaryStructureName, selectedProjectName, t, type]);

  const isAutoSubjectType = AUTO_SUBJECT_TYPES.has(type);

  useEffect(() => {
    if (!autoSubject) return;
    if (subjectDirty) return;
    if (subject === autoSubject) return;
    setSubject(autoSubject);
  }, [autoSubject, subject, subjectDirty]);

  useEffect(() => {
    if (!AUTO_SUBJECT_TYPES.has(type) && subjectDirty) {
      setSubjectDirty(false);
    }
  }, [subjectDirty, type]);

  useEffect(() => {
    if (!open) return;
    setSubject(interaction.subject);
    setSubjectDirty(false);
    setType(interaction.type);
    setStatus(interaction.status ?? "");
    setOccurredAt(toLocalDateTimeInput(interaction.occurred_at) || "");
    setTagIds(interaction.tags.map((tag) => tag.id));
    setContactIds(interaction.contacts.map((contact) => contact.id));
    setStructureIds(interaction.structures.map((structure) => structure.id));
    setSelectedProjectId(interaction.project?.id ?? interaction.project_id ?? null);
    setQuoteAmount(
      interaction.type === "quote" ? formatAmountForInput(extractAmountFromMetadata(interaction.metadata)) : ""
    );
    setFormError("");
    setError("");
    setProjectError("");
  }, [interaction, open, setError]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    const effectiveSubject = !subjectDirty && autoSubject ? autoSubject : subject;
    const trimmedSubject = effectiveSubject.trim();
    if (!trimmedSubject) {
      setFormError(t("interactionssubjectRequired"));
      return;
    }

    if (type === "artisan_visit" && contactIds.length === 0) {
      setFormError(t("interactionsartisanVisitContactRequired"));
      return;
    }

    if (type === "quote" && contactIds.length === 0 && structureIds.length === 0) {
      setFormError(t("interactionsquoteAssociationRequired"));
      return;
    }

    const occurredAtIso = toIsoStringFromInput(occurredAt) ?? interaction.occurred_at;

    let metadataPayload: Record<string, unknown> | null | undefined;
    if (type === "quote") {
      const trimmedAmount = quoteAmount.trim();
      if (!trimmedAmount) {
        setFormError(t("interactionsamountRequired"));
        return;
      }
      const parsedAmount = parseAmountInput(trimmedAmount);
      if (parsedAmount === null) {
        setFormError(t("interactionsamountInvalid"));
        return;
      }
      metadataPayload = { amount: parsedAmount };
    } else if (interaction.type === "quote") {
      metadataPayload = null;
    }

    try {
      await updateInteraction(interaction.id, {
        subject: trimmedSubject,
        type,
        status: status === "" ? null : (status as InteractionStatus),
        occurredAt: occurredAtIso,
        projectId: selectedProjectId,
        tagIds,
        contactIds,
        structureIds,
        metadata: metadataPayload,
      });
      show({ title: t("interactionsupdated"), variant: "success" });
      onSaved();
      onOpenChange(false);
    } catch (updateError) {
      console.error(updateError);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
      onOpenChange(next);
      if (!next) {
        setFormError("");
        setError("");
        setSubjectDirty(false);
        setProjectError("");
      }
    }}
  >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" aria-describedby="Test">
        <DialogHeader>
          <DialogTitle>{t("interactionsedit.title")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="edit-interaction-subject">
                {t("common.subject")}
              </label>
              <Input
                id="edit-interaction-subject"
                value={subject}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setSubject(nextValue);
                  setSubjectDirty(nextValue.trim().length > 0);
                }}
                placeholder={t("interactionssubjectPlaceholder")}
                aria-describedby={isAutoSubjectType ? "edit-interaction-subject-auto" : undefined}
              />
              {isAutoSubjectType ? (
                <p id="edit-interaction-subject-auto" className="flex items-center gap-2 text-xs text-gray-500">
                  <Info className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                  {t("interactionsautoSubjectNotice")}
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="edit-interaction-type">
                  {t("interactionstypeLabel")}
                </label>
                <select
                  id="edit-interaction-type"
                  value={type}
                  onChange={(event) => {
                    const nextType = event.target.value as InteractionType;
                    setType(nextType);
                    if (AUTO_SUBJECT_TYPES.has(nextType)) {
                      setSubjectDirty(false);
                    }
                  }}
                  className="border rounded-md h-9 w-full px-3 text-sm bg-background"
                >
                  {INTERACTION_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {t(`interactionstypes.${value}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="edit-interaction-status">
                  {t("interactionsstatusLabel")}
                </label>
                <select
                  id="edit-interaction-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as InteractionStatus | "")}
                  className="border rounded-md h-9 w-full px-3 text-sm bg-background"
                >
                  {INTERACTION_STATUSES.map((value) => (
                    <option key={value ?? "none"} value={value ?? ""}>
                      {value ? t(`interactionsstatus.${value}`) : t("interactionsstatusNone")}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="edit-interaction-project">
                {t("interactionsprojectLabel")}
              </label>
              <select
                id="edit-interaction-project"
                value={selectedProjectId ?? ""}
                onChange={(event) => setSelectedProjectId(event.target.value ? event.target.value : null)}
                disabled={projectLoading}
                className="border rounded-md h-9 w-full px-3 text-sm bg-background disabled:opacity-60"
              >
                <option value="">{t("interactionsprojectNone")}</option>
                {projectOptionsWithFallback.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.title} · {t(`projects.status.${option.status}`)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">{t("interactionsprojectHelper")}</p>
              {projectError ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">{projectError}</div>
              ) : null}
            </div>

            {type === "quote" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="edit-interaction-quote-amount">
                  {t("interactionsamountLabel")}
                </label>
                <Input
                  id="edit-interaction-quote-amount"
                  value={quoteAmount}
                  onChange={(event) => setQuoteAmount(event.target.value)}
                  placeholder={t("interactionsamountPlaceholder")}
                />
                <p className="text-xs text-gray-500">{t("interactionsamountHelper")}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="edit-interaction-occurred-at">
                {t("interactionsoccurredAtLabel")}
              </label>
              <Input
                id="edit-interaction-occurred-at"
                type="datetime-local"
                value={occurredAt}
                onChange={(event) => setOccurredAt(event.target.value)}
              />
            </div>
          </div>

          <InteractionTagsSelector
            householdId={interaction.household_id}
            value={tagIds}
            onChange={setTagIds}
            inputId="edit-interaction-tags"
          />

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">{t("interactionscontacts.label")}</label>
            <p className="text-xs text-gray-500">{t("interactionscontacts.helper")}</p>
            <ContactSelector householdId={interaction.household_id} value={contactIds} onChange={setContactIds} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">{t("interactionsstructures.label")}</label>
            <p className="text-xs text-gray-500">{t("interactionsstructures.helper")}</p>
            <StructureSelector householdId={interaction.household_id} value={structureIds} onChange={setStructureIds} />
          </div>

          {(formError || error) && (
            <div className="text-sm text-red-600 border border-red-200 rounded p-2 bg-red-50">
              {formError || error}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                onOpenChange(false);
                setFormError("");
                setError("");
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
