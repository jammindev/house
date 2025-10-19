"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ToastProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { Interaction } from "@interactions/types";

type MinimalInteraction = Pick<Interaction, "id" | "subject" | "type" | "occurred_at" | "status">;

interface ProjectLinkInteractionModalProps {
  open: boolean;
  projectId: string;
  onOpenChange: (next: boolean) => void;
  onLinked: () => void;
}

export default function ProjectLinkInteractionModal({
  open,
  projectId,
  onOpenChange,
  onLinked,
}: ProjectLinkInteractionModalProps) {
  const { selectedHouseholdId: householdId } = useGlobal();
  const { show } = useToast();
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [interactions, setInteractions] = useState<MinimalInteraction[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!householdId || !open) return;
    setLoading(true);
    setError("");
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const { data, error: loadError } = await client
        .from("interactions")
        .select("id, subject, type, status, occurred_at")
        .eq("household_id", householdId)
        .is("project_id", null)
        .order("occurred_at", { ascending: false })
        .limit(100);
      if (loadError) throw loadError;
      setInteractions((data ?? []) as MinimalInteraction[]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("common.unexpectedError");
      setError(message);
      setInteractions([]);
    } finally {
      setLoading(false);
    }
  }, [householdId, open, t]);

  useEffect(() => {
    if (open) {
      setSelectedIds(new Set());
      setSearch("");
      void load();
    }
  }, [load, open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return interactions;
    const normalized = search.trim().toLowerCase();
    return interactions.filter((interaction) => interaction.subject.toLowerCase().includes(normalized));
  }, [interactions, search]);

  const handleToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = useCallback(async () => {
    if (!householdId || !selectedIds.size) return;
    setSaving(true);
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const { error: updateError } = await client
        .from("interactions")
        .update({ project_id: projectId })
        .in("id", Array.from(selectedIds));
      if (updateError) throw updateError;
      show({ title: t("projects.linkInteraction.success"), variant: "success" });
      onLinked();
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("common.unexpectedError");
      show({ title: message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }, [householdId, onLinked, onOpenChange, projectId, selectedIds, show, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("projects.linkInteraction.title")}</DialogTitle>
          <DialogDescription>{t("projects.linkInteraction.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("projects.linkInteraction.searchPlaceholder")}
          />
          {error ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">{error}</div>
          ) : null}
          <div className="max-h-72 overflow-y-auto rounded-md border border-slate-200">
            {loading ? (
              <div className="p-4 text-sm text-slate-500">{t("common.loading")}</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">{t("projects.linkInteraction.empty")}</div>
            ) : (
              <ul className="divide-y divide-slate-200">
                {filtered.map((interaction) => {
                  const checked = selectedIds.has(interaction.id);
                  return (
                    <li key={interaction.id}>
                      <label className="flex cursor-pointer items-start gap-3 p-3 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-slate-300"
                          checked={checked}
                          onChange={() => handleToggle(interaction.id)}
                        />
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-slate-900">{interaction.subject}</span>
                          <span className="text-xs text-slate-500">
                            {interaction.type} ·{" "}
                            {new Intl.DateTimeFormat(locale, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(interaction.occurred_at))}
                          </span>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="button" disabled={!selectedIds.size || saving} onClick={() => void handleSubmit()}>
            {saving ? t("projects.linkInteraction.saving") : t("projects.linkInteraction.confirm", { count: selectedIds.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
