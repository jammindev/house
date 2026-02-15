// nextjs/src/features/projects/components/ProjectLinksPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, ExternalLink, Link2, MousePointerClick } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ToastProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { Interaction, InteractionStatus, ZoneOption } from "@interactions/types";

type LinkMetadata = {
  url?: string;
  title?: string;
  description?: string | null;
  clicks?: number;
  last_clicked_at?: string | null;
};

type ProjectLinksPanelProps = {
  projectId: string;
  projectZones?: ZoneOption[];
  links: Interaction[];
  onRefresh?: () => void;
};

const statusOptions: InteractionStatus[] = ["pending", "in_progress", "done", "archived"];

const normalizeUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const extractLinkMetadata = (interaction: Interaction): LinkMetadata => {
  const meta = interaction.metadata && typeof interaction.metadata === "object" ? interaction.metadata : {};
  // Prefer nested link object, fallback to flat structure
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkMeta = (meta as any).link && typeof (meta as any).link === "object" ? (meta as any).link : meta;
  const url = typeof (linkMeta as any)?.url === "string" ? (linkMeta as any).url : undefined;
  const title = typeof (linkMeta as any)?.title === "string" ? (linkMeta as any).title : undefined;
  const description =
    typeof (linkMeta as any)?.description === "string" && (linkMeta as any).description.length
      ? (linkMeta as any).description
      : null;
  const clicksValue = (linkMeta as any)?.clicks;
  const clicks = typeof clicksValue === "number" && Number.isFinite(clicksValue) ? clicksValue : 0;
  const lastClicked = typeof (linkMeta as any)?.last_clicked_at === "string" ? (linkMeta as any).last_clicked_at : null;
  return {
    url,
    title,
    description,
    clicks,
    last_clicked_at: lastClicked,
  };
};

export default function ProjectLinksPanel({
  projectId,
  projectZones = [],
  links,
  onRefresh,
}: ProjectLinksPanelProps) {
  const { t, locale } = useI18n();
  const { show } = useToast();
  const { selectedHouseholdId: householdId } = useGlobal();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<InteractionStatus>("pending");
  const [zoneId, setZoneId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!zoneId && projectZones.length > 0) {
      setZoneId(projectZones[0].id);
    }
  }, [projectZones, zoneId]);

  const parsedLinks = useMemo(
    () =>
      links.map((interaction) => ({
        interaction,
        meta: extractLinkMetadata(interaction),
      })),
    [links]
  );

  const formatDate = (value?: string | null) => {
    if (!value) return t("projects.links.neverOpened");
    try {
      return new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value));
    } catch {
      return value;
    }
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || !householdId) return;
    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) {
      show({ title: t("projects.links.urlRequired"), variant: "error" });
      return;
    }
    if (!zoneId) {
      show({ title: t("projects.links.zoneRequired"), variant: "error" });
      return;
    }
    setSubmitting(true);
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const subject = title.trim() || normalizedUrl;
      const descriptionValue = description.trim();

      const metadata: { link: LinkMetadata } = {
        link: {
          url: normalizedUrl,
          title: subject,
          description: descriptionValue || null,
          clicks: 0,
          last_clicked_at: null,
        },
      };

      const { data: createdId, error } = await client.rpc("create_interaction_with_zones", {
        p_household_id: householdId,
        p_subject: subject,
        p_zone_ids: [zoneId],
        p_content: descriptionValue || null,
        p_type: "link",
        p_status: status,
        p_occurred_at: new Date().toISOString(),
        p_project_id: projectId,
        p_metadata: metadata,
      });

      if (error || !createdId) {
        throw error ?? new Error("Failed to create link");
      }

      setUrl("");
      setTitle("");
      setDescription("");
      setStatus("pending");
      show({ title: t("projects.links.created"), variant: "success" });
      onRefresh?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("projects.links.createFailed");
      show({ title: message, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (interaction: Interaction, nextStatus: InteractionStatus) => {
    if (!householdId || interaction.status === nextStatus) return;
    setUpdatingId(interaction.id);
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const { error } = await client
        .from("interactions")
        .update({ status: nextStatus })
        .eq("id", interaction.id)
        .eq("household_id", householdId);
      if (error) throw error;
      onRefresh?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("projects.links.updateFailed");
      show({ title: message, variant: "error" });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleOpenLink = async (interaction: Interaction) => {
    const meta = extractLinkMetadata(interaction);
    const targetUrl = normalizeUrl(meta.url || interaction.content || interaction.subject);
    if (!targetUrl) {
      show({ title: t("projects.links.urlMissing"), variant: "error" });
      return;
    }

    // Open immediately for UX, then record click count
    window.open(targetUrl, "_blank", "noopener,noreferrer");

    if (!householdId) return;
    setUpdatingId(interaction.id);
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const nextClicks = (meta.clicks ?? 0) + 1;
      const nextMetadata = {
        ...(interaction.metadata ?? {}),
        link: {
          ...meta,
          url: targetUrl,
          clicks: nextClicks,
          last_clicked_at: new Date().toISOString(),
          title: meta.title ?? interaction.subject,
          description: meta.description ?? interaction.content ?? null,
        },
      };
      const { error } = await client
        .from("interactions")
        .update({ metadata: nextMetadata })
        .eq("id", interaction.id)
        .eq("household_id", householdId);
      if (error) throw error;
      onRefresh?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("projects.links.updateFailed");
      show({ title: message, variant: "error" });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-50 text-sky-600">
            <Link2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">{t("projects.links.addTitle")}</h3>
            <p className="text-sm text-slate-500">{t("projects.links.addSubtitle")}</p>
          </div>
        </div>

        <form className="mt-4 space-y-4" onSubmit={handleCreate}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                {t("projects.links.urlLabel")}
              </label>
              <Input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://exemple.com"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                {t("projects.links.titleLabel")}
              </label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("projects.links.titlePlaceholder")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              {t("projects.links.descriptionLabel")}
            </label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("projects.links.descriptionPlaceholder")}
              rows={3}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                {t("projects.links.zoneLabel")}
              </label>
              <Select value={zoneId} onValueChange={setZoneId} disabled={!projectZones.length}>
                <SelectTrigger>
                  <SelectValue placeholder={t("projects.links.zonePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {projectZones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!projectZones.length ? (
                <p className="text-xs text-amber-600">{t("projects.links.zoneHelper")}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                {t("projects.links.statusLabel")}
              </label>
              <Select value={status} onValueChange={(value) => setStatus(value as InteractionStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("projects.links.statusPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`interactionsstatus.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={submitting || !projectZones.length}>
              {submitting ? t("common.saving") : t("projects.links.save")}
            </Button>
          </div>
        </form>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-base font-semibold text-slate-900">{t("projects.links.listTitle")}</h4>
            <p className="text-sm text-slate-500">
              {t("projects.links.listSubtitle", { count: links.length })}
            </p>
          </div>
          <Badge variant="outline" className="flex items-center gap-2 border-sky-200 bg-sky-50 text-sky-700">
            <MousePointerClick className="h-4 w-4" />
            {links.length}
          </Badge>
        </div>

        {parsedLinks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
            {t("projects.links.empty")}
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3">
            {parsedLinks.map(({ interaction, meta }) => {
              const isUpdating = updatingId === interaction.id;
              const clicks = meta.clicks ?? 0;
              const statusLabel = interaction.status
                ? t(`interactionsstatus.${interaction.status}`)
                : t("interactionsstatusNone");
              const clicksLabel =
                clicks === 1
                  ? t("projects.links.clicksOne")
                  : t("projects.links.clicksOther", { count: clicks });
              return (
                <li
                  key={interaction.id}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-200"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-sky-600" />
                        <span className="text-sm font-semibold text-slate-900">
                          {meta.title || interaction.subject}
                        </span>
                      </div>
                      {meta.url ? (
                        <p className="text-xs text-slate-500 break-all">{meta.url}</p>
                      ) : null}
                      {meta.description || interaction.content ? (
                        <p className="text-xs text-slate-500">
                          {meta.description || interaction.content}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                        {statusLabel}
                      </Badge>
                      <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
                        <MousePointerClick className="mr-1 h-3.5 w-3.5" />
                        {clicksLabel}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <div className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>{formatDate(meta.last_clicked_at)}</span>
                    </div>
                    {interaction.occurred_at ? (
                      <div className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
                        <span>{t("projects.links.loggedAt", {
                          date: formatDate(interaction.occurred_at),
                        })}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleOpenLink(interaction)}
                      disabled={isUpdating}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      {t("projects.links.open")}
                    </Button>
                    <Select
                      value={interaction.status ?? "pending"}
                      onValueChange={(value) => void handleStatusChange(interaction, value as InteractionStatus)}
                      disabled={isUpdating}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder={t("projects.links.statusPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {t(`interactionsstatus.${option}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
