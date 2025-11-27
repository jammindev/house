// nextjs/src/features/interactions/hooks/useInteractions.ts
"use client";
import { useEffect, useMemo, useState } from "react";

import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type {
  Document,
  Interaction,
  InteractionContact,
  InteractionListFilters,
  InteractionProjectSummary,
  InteractionStructure,
  InteractionTag,
} from "@interactions/types";
import { DEFAULT_INTERACTION_FILTERS } from "@interactions/constants";
import { useGlobal } from "@/lib/context/GlobalContext";
import { usePersistentFilters } from "@shared/hooks/usePersistentFilters";

type DocumentsByInteraction = Record<string, Document[]>;
type RawInteraction = {
  id: string;
  household_id: string;
  subject: string;
  content: string;
  type: Interaction["type"];
  status: Interaction["status"];
  occurred_at: string;
  project_id?: string | null;
  project?: RawProject | null;
  metadata: Interaction["metadata"];
  enriched_text: Interaction["enriched_text"];
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  interaction_tags?: { tag?: InteractionTag | null }[] | null;
  interaction_contacts?: { contact?: RawContact | null }[] | null;
  interaction_structures?: { structure?: RawStructure | null }[] | null;
};

type RawProject = {
  id: string;
  title?: string | null;
  status?: InteractionProjectSummary["status"] | null;
};

type RawContactEmail = {
  id: string;
  email?: string | null;
  label?: string | null;
  is_primary?: boolean | null;
  created_at?: string | null;
};

type RawContactPhone = {
  id: string;
  phone?: string | null;
  label?: string | null;
  is_primary?: boolean | null;
  created_at?: string | null;
};

type RawContact = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  structure?: RawStructure | null;
  emails?: RawContactEmail[] | null;
  phones?: RawContactPhone[] | null;
};

type RawStructureEmail = {
  id: string;
  email?: string | null;
  label?: string | null;
  is_primary?: boolean | null;
  created_at?: string | null;
};

type RawStructurePhone = {
  id: string;
  phone?: string | null;
  label?: string | null;
  is_primary?: boolean | null;
  created_at?: string | null;
};

type RawStructure = {
  id: string;
  name?: string | null;
  type?: string | null;
  emails?: RawStructureEmail[] | null;
  phones?: RawStructurePhone[] | null;
};

type RawInteractionDocument = {
  interaction_id: string;
  role: string | null;
  note: string | null;
  created_at: string;
  document: {
    id: string;
    household_id: string;
    file_path: string;
    mime_type: string | null;
    type: Document["type"];
    name: string;
    notes: string;
    metadata: Document["metadata"];
    created_at: string;
    created_by: string | null;
  } | null;
};

const normalizeText = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const normalizeBoolean = (value?: boolean | null) => value === true;

const normalizeContactEmail = (email: RawContactEmail) => ({
  id: email.id,
  email: normalizeText(email.email) ?? "",
  label: normalizeText(email.label),
  is_primary: normalizeBoolean(email.is_primary),
  created_at: email.created_at ?? null,
});

const normalizeContactPhone = (phone: RawContactPhone) => ({
  id: phone.id,
  phone: normalizeText(phone.phone) ?? "",
  label: normalizeText(phone.label),
  is_primary: normalizeBoolean(phone.is_primary),
  created_at: phone.created_at ?? null,
});

const normalizeStructureEmail = (email: RawStructureEmail) => ({
  id: email.id,
  email: normalizeText(email.email) ?? "",
  label: normalizeText(email.label),
  is_primary: normalizeBoolean(email.is_primary),
  created_at: email.created_at ?? null,
});

const normalizeStructurePhone = (phone: RawStructurePhone) => ({
  id: phone.id,
  phone: normalizeText(phone.phone) ?? "",
  label: normalizeText(phone.label),
  is_primary: normalizeBoolean(phone.is_primary),
  created_at: phone.created_at ?? null,
});

export function useInteractions() {
  const { selectedHouseholdId: householdId } = useGlobal();
  const { t } = useI18n();
  const [allInteractions, setAllInteractions] = useState<Interaction[]>([]);
  const [documentsByInteraction, setDocumentsByInteraction] = useState<DocumentsByInteraction>({});
  const [documentCounts, setDocumentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { filters, setFilters, resetFilters } = usePersistentFilters<InteractionListFilters>({
    key: "interaction-filters",
    fallback: DEFAULT_INTERACTION_FILTERS,
    scope: householdId,
  });

  const interactions = useMemo(() => {
    const searchTerm = filters.search?.trim().toLowerCase() || null;
    const typeFilters = (filters.types ?? []).length ? new Set(filters.types ?? []) : null;
    const statusFilters = (filters.statuses ?? []).length ? new Set(filters.statuses ?? []) : null;
    const occurredFrom = filters.occurredFrom ?? null;
    const occurredTo = filters.occurredTo ?? null;

    return allInteractions.filter((interaction) => {
      if (typeFilters && !typeFilters.has(interaction.type)) {
        return false;
      }

      if (statusFilters && !statusFilters.has(interaction.status ?? null)) {
        return false;
      }

      const occurredDate = interaction.occurred_at.slice(0, 10);
      if (occurredFrom && occurredDate < occurredFrom) {
        return false;
      }
      if (occurredTo && occurredDate > occurredTo) {
        return false;
      }

      if (searchTerm) {
        const haystack = [
          interaction.subject,
          interaction.content,
          interaction.tags.map((tag) => tag.name).join(" "),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(searchTerm)) {
          return false;
        }
      }

      return true;
    });
  }, [filters, allInteractions]);

  useEffect(() => {
    const load = async () => {
      setError("");
      setLoading(true);
      setAllInteractions([]);
      setDocumentsByInteraction({});
      try {
        if (!householdId) return;
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();
        const { data: interactionData, error: interactionError } = await client
          .from("interactions")
          .select(
            `
              id,
              subject,
              content,
              type,
              status,
              occurred_at,
              project_id,
              project:projects!interactions_project_id_fkey(
                id,
                title,
                status
              ),
              created_at,
              updated_at,
              household_id,
              metadata,
              enriched_text,
              created_by,
              updated_by,
              interaction_tags:interaction_tags(
                tag:tags(
                  id,
                  household_id,
                  type,
                  name,
                  created_at,
                  created_by
                )
              ),
              interaction_contacts:interaction_contacts(
                contact:contacts(
                  id,
                  first_name,
                  last_name,
                  position,
                  emails:emails(
                    id,
                    email,
                    label,
                    is_primary,
                    created_at
                  ),
                  phones:phones(
                    id,
                    phone,
                    label,
                    is_primary,
                    created_at
                  ),
                  structure:structures(
                    id,
                    name,
                    type
                  )
                )
              ),
              interaction_structures:interaction_structures(
                structure:structures(
                  id,
                  name,
                  type,
                  emails:emails!emails_structure_id_fkey(
                    id,
                    email,
                    label,
                    is_primary,
                    created_at
                  ),
                  phones:phones!phones_structure_id_fkey(
                    id,
                    phone,
                    label,
                    is_primary,
                    created_at
                  )
                )
              )
            `
          )
          .eq("household_id", householdId)
          .order("occurred_at", { ascending: false })
          .limit(100);
        if (interactionError) throw interactionError;
        const list = (interactionData ?? []) as RawInteraction[];
        const normalized: Interaction[] = list.map((item) => {
          const project: InteractionProjectSummary | null = item.project
            ? {
              id: item.project.id,
              title: item.project.title?.trim() ?? "",
              status: (item.project.status ?? "draft") as InteractionProjectSummary["status"],
            }
            : null;
          const tags =
            item.interaction_tags
              ?.map((entry) => entry?.tag)
              .filter((tag): tag is InteractionTag => Boolean(tag)) ?? [];

          return {
            id: item.id,
            household_id: item.household_id,
            subject: item.subject,
            content: item.content,
            type: item.type,
            status: item.status,
            occurred_at: item.occurred_at,
            project_id: item.project_id ?? project?.id ?? null,
            project,
            tags,
            contacts:
              item.interaction_contacts
                ?.map((link) => link?.contact)
                .filter((contact): contact is RawContact => Boolean(contact))
                .map<InteractionContact>((contact) => ({
                  id: contact.id,
                  first_name: normalizeText(contact.first_name) ?? "",
                  last_name: normalizeText(contact.last_name) ?? "",
                  position: normalizeText(contact.position),
                  structure: contact.structure
                    ? {
                      id: contact.structure.id,
                      name: normalizeText(contact.structure.name) ?? "",
                      type: normalizeText(contact.structure.type),
                    }
                    : null,
                  emails: contact.emails?.map((email) => normalizeContactEmail(email)) ?? [],
                  phones: contact.phones?.map((phone) => normalizeContactPhone(phone)) ?? [],
                })) ?? [],
            structures:
              item.interaction_structures
                ?.map((link) => link?.structure)
                .filter((structure): structure is RawStructure => Boolean(structure))
                .map<InteractionStructure>((structure) => ({
                  id: structure.id,
                  name: normalizeText(structure.name) ?? "",
                  type: normalizeText(structure.type),
                  emails: structure.emails?.map((email) => normalizeStructureEmail(email)) ?? [],
                  phones: structure.phones?.map((phone) => normalizeStructurePhone(phone)) ?? [],
                })) ?? [],
            metadata: item.metadata,
            enriched_text: item.enriched_text,
            created_at: item.created_at,
            updated_at: item.updated_at,
            created_by: item.created_by ?? null,
            updated_by: item.updated_by ?? null,
          };
        });
        setAllInteractions(normalized);

        const ids = normalized.map((interaction) => interaction.id);
        if (ids.length > 0) {
          const { data: documentData, error: documentError } = await client
            .from("interaction_documents")
            .select(
              `
                interaction_id,
                role,
                note,
                created_at,
                document:documents (
                  id,
                  household_id,
                  file_path,
                  mime_type,
                  type,
                  name,
                  notes,
                  metadata,
                  created_at,
                  created_by
                )
              `
            )
            .in("interaction_id", ids);
          if (documentError) throw documentError;
          const grouped: DocumentsByInteraction = {};
          (documentData ?? []).forEach((raw) => {
            const row = raw as RawInteractionDocument;
            const docRow = row.document;
            if (!docRow) return;
            const interactionId = row.interaction_id;
            if (!interactionId) return;
            const doc: Document = {
              id: docRow.id,
              household_id: docRow.household_id,
              file_path: docRow.file_path,
              name: docRow.name ?? "",
              notes: docRow.notes ?? "",
              mime_type: docRow.mime_type ?? null,
              type: (docRow.type ?? "document") as Document["type"],
              metadata: docRow.metadata,
              created_at: docRow.created_at,
              created_by: docRow.created_by ?? null,
              interaction_id: interactionId,
              link_role: row.role ?? null,
              link_note: row.note ?? null,
              link_created_at: row.created_at ?? null,
            };
            const arr = grouped[interactionId] || [];
            arr.push(doc);
            grouped[interactionId] = arr;
          });
          setDocumentsByInteraction(grouped);
          const counts: Record<string, number> = {};
          Object.keys(grouped).forEach((key) => {
            counts[key] = grouped[key].length;
          });
          setDocumentCounts(counts);
        }
      } catch (error: unknown) {
        console.error(error);
        const message = error instanceof Error ? error.message : t("interactionslistLoadFailed");
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [householdId, t]);

  return {
    interactions,
    documentsByInteraction,
    documentCounts,
    loading,
    error,
    setError,
    filters,
    setFilters,
    resetFilters,
  };
}
