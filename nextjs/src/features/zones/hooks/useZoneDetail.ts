// nextjs/src/features/zones/hooks/useZoneDetail.ts
"use client";

import { useCallback, useEffect, useState } from "react";

import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { ZoneDetail } from "../types";
import type {
  Interaction,
  InteractionContact,
  InteractionProjectSummary,
  InteractionStructure,
  InteractionTag,
} from "@interactions/types";

type RawZoneRow = {
  id: string;
  name: string;
  note: string | null;
  surface: number | null;
  color: string;
  household_id: string;
  parent_id: string | null;
  created_at: string | null;
  created_by: string | null;
  parent?: {
    id: string;
    name: string;
    color?: string | null;
  } | null;
};

type RawZoneInteractionRow = {
  interaction_id: string;
  interaction: RawInteraction | null;
};

type RawDocumentCountRow = {
  interaction_id: string | null;
};

type RawInteraction = {
  id: string;
  household_id: string;
  subject: string;
  content: string;
  type: Interaction["type"];
  status: Interaction["status"];
  occurred_at: string;
  project_id?: string | null;
  metadata: Interaction["metadata"];
  enriched_text: Interaction["enriched_text"];
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  interaction_tags?: { tag?: InteractionTag | null }[] | null;
  interaction_contacts?: { contact?: RawContact | null }[] | null;
  interaction_structures?: { structure?: RawStructure | null }[] | null;
  project?: RawProject | null;
};

type RawContact = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  structure?: RawStructure | null;
};

type RawStructure = {
  id: string;
  name?: string | null;
  type?: string | null;
};

type RawProject = {
  id: string;
  title?: string | null;
  status?: InteractionProjectSummary["status"] | null;
};

export function useZoneDetail(zoneId?: string) {
  const [zone, setZone] = useState<ZoneDetail | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [documentCounts, setDocumentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!zoneId) {
      setZone(null);
      setInteractions([]);
      setDocumentCounts({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      const { data: zoneRow, error: zoneError } = await client
        .from("zones")
        .select(
          `
            id,
            name,
            note,
            surface,
            color,
            household_id,
            parent_id,
            created_at,
            created_by,
            parent:zones!zones_parent_id_fkey(
              id,
              name,
              color
            )
          `
        )
        .eq("id", zoneId)
        .maybeSingle();
      if (zoneError) throw zoneError;

      const rawZone = (zoneRow as RawZoneRow | null) ?? null;

      const parsedZone: ZoneDetail | null = rawZone
        ? {
          id: rawZone.id,
          name: rawZone.name,
          note: rawZone.note,
          surface: rawZone.surface,
          color: rawZone.color,
          household_id: rawZone.household_id ?? "",
          parent_id: rawZone.parent_id,
          created_at: rawZone.created_at,
          created_by: rawZone.created_by ?? undefined,
          parent: rawZone.parent
            ? {
              id: rawZone.parent.id,
              name: rawZone.parent.name,
              color: rawZone.parent.color ?? undefined,
            }
            : null,
        }
        : null;
      setZone(parsedZone);

      if (!parsedZone) {
        setInteractions([]);
        setDocumentCounts({});
        return;
      }

      const { data: interactionRows, error: interactionsError } = await client
        .from("interaction_zones")
        .select(
          `
            interaction_id,
            interaction:interactions(
              id,
              subject,
              content,
              type,
              status,
              occurred_at,
              project_id,
              metadata,
              enriched_text,
              created_at,
              updated_at,
              household_id,
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
                  type
                )
              ),
              project:projects!interactions_project_id_fkey(
                id,
                title,
                status
              )
            )
          `
        )
        .eq("zone_id", zoneId);
      if (interactionsError) throw interactionsError;

      const rawInteractions = (interactionRows ?? []) as RawZoneInteractionRow[];
      const mappedInteractions = rawInteractions
        .map((row) => row.interaction)
        .filter((raw): raw is RawInteraction => Boolean(raw))
        .map(mapInteraction);

      mappedInteractions.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
      setInteractions(mappedInteractions);

      const interactionIds = mappedInteractions.map((item) => item.id);
      if (interactionIds.length > 0) {
        const { data: docRows, error: docError } = await client
          .from("interaction_documents")
          .select("interaction_id")
          .in("interaction_id", interactionIds);
        if (docError) throw docError;
        const counts: Record<string, number> = {};
        const rows = (docRows ?? []) as RawDocumentCountRow[];
        rows.forEach((row) => {
          const interactionId = row.interaction_id;
          if (!interactionId) return;
          counts[interactionId] = (counts[interactionId] ?? 0) + 1;
        });
        setDocumentCounts(counts);
      } else {
        setDocumentCounts({});
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load zone details");
    } finally {
      setLoading(false);
    }
  }, [zoneId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { zone, interactions, documentCounts, loading, error, reload: load };
}

function mapInteraction(raw: RawInteraction): Interaction {
  const project: InteractionProjectSummary | null = raw.project
    ? {
      id: raw.project.id,
      title: raw.project.title?.trim() ?? "",
      status: (raw.project.status ?? "draft") as InteractionProjectSummary["status"],
    }
    : null;
  const tags = raw.interaction_tags?.map((entry) => entry?.tag).filter((tag): tag is InteractionTag => Boolean(tag)) ?? [];

  const contacts =
    raw.interaction_contacts
      ?.map((link) => link?.contact)
      .filter((contact): contact is RawContact => Boolean(contact))
      .map<InteractionContact>((contact) => ({
        id: contact.id,
        first_name: contact.first_name?.trim() ?? "",
        last_name: contact.last_name?.trim() ?? "",
        position: contact.position?.trim() || null,
        structure: contact.structure
          ? {
            id: contact.structure.id,
            name: contact.structure.name?.trim() ?? "",
            type: contact.structure.type?.trim() || null,
          }
          : null,
      })) ?? [];

  const structures =
    raw.interaction_structures
      ?.map((link) => link?.structure)
      .filter((structure): structure is RawStructure => Boolean(structure))
      .map<InteractionStructure>((structure) => ({
        id: structure.id,
        name: structure.name?.trim() ?? "",
        type: structure.type?.trim() || null,
      })) ?? [];

  return {
    id: raw.id,
    household_id: raw.household_id,
    subject: raw.subject,
    content: raw.content,
    type: raw.type,
    status: raw.status,
    occurred_at: raw.occurred_at,
    project_id: raw.project_id ?? project?.id ?? null,
    project,
    tags,
    contacts,
    structures,
    metadata: raw.metadata,
    enriched_text: raw.enriched_text,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    created_by: raw.created_by ?? null,
    updated_by: raw.updated_by ?? null,
  };
}
