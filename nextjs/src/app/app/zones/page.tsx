"use client";

import React, { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  Layers,
  Ruler,
  StickyNote,
  Pencil,
  Trash2,
  Loader2,
  type LucideIcon,
} from "lucide-react";

type Zone = {
  id: string;
  name: string;
  created_by?: string;
  parent_id?: string | null;
  note?: string | null;
  surface?: number | null;
};

export default function ZonesPage() {
  const { loading: globalLoading, selectedHouseholdId, households } = useGlobal();
  const { t } = useI18n();
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const [showNew, setShowNew] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>("");
  const [newParentId, setNewParentId] = useState<string | "">("");
  const [newSurface, setNewSurface] = useState<string>("");
  const [newNote, setNewNote] = useState<string>("");
  const [creating, setCreating] = useState<boolean>(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [editingParentId, setEditingParentId] = useState<string | "">("");
  const [editingSurface, setEditingSurface] = useState<string>("");
  const [editingNote, setEditingNote] = useState<string>("");
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Zone | null>(null);

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }),
    []
  );

  const { zonesById, sortedZones, zoneDepths, zoneStats } = useMemo(() => {
    if (zones.length === 0) {
      return {
        zonesById: new Map<string, Zone>(),
        sortedZones: [] as Zone[],
        zoneDepths: new Map<string, number>(),
        zoneStats: {
          totalCount: 0,
          rootCount: 0,
          childCount: 0,
          surfaceSum: 0,
          hasSurfaceData: false,
        },
      };
    }

    const byId = new Map<string, Zone>();
    zones.forEach(zone => {
      byId.set(zone.id, zone);
    });

    const childByParent = new Map<string | null, Zone[]>();
    zones.forEach(zone => {
      const key = zone.parent_id ?? null;
      const existing = childByParent.get(key) ?? [];
      existing.push(zone);
      childByParent.set(key, existing);
    });

    childByParent.forEach(list => {
      list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    });

    const zoneDepths = new Map<string, number>();
    const ordered: Zone[] = [];
    const visited = new Set<string>();

    const visit = (zone: Zone, depth: number) => {
      if (visited.has(zone.id)) return;
      visited.add(zone.id);
      zoneDepths.set(zone.id, depth);
      ordered.push(zone);
      const children = childByParent.get(zone.id);
      if (children) {
        children.forEach(child => visit(child, depth + 1));
      }
    };

    const rootCandidates = (childByParent.get(null) ?? []).slice().sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
    rootCandidates.forEach(root => visit(root, 0));

    zones.forEach(zone => {
      if (!visited.has(zone.id)) {
        visit(zone, 0);
      }
    });

    let surfaceSum = 0;
    let hasSurfaceData = false;
    let rootCount = 0;

    zones.forEach(zone => {
      const parent = zone.parent_id ? byId.get(zone.parent_id) : null;
      const hasParent = !!(parent && parent.id !== zone.id);
      if (!hasParent) {
        rootCount += 1;
      }
      if (typeof zone.surface === "number" && !Number.isNaN(zone.surface)) {
        surfaceSum += zone.surface;
        hasSurfaceData = true;
      }
    });

    const zoneStats = {
      totalCount: zones.length,
      rootCount,
      childCount: zones.length - rootCount,
      surfaceSum,
      hasSurfaceData,
    };

    return {
      zonesById: byId,
      sortedZones: ordered,
      zoneDepths,
      zoneStats,
    };
  }, [zones]);

  const formatZoneOptionLabel = (zone: Zone) => {
    const depth = zoneDepths.get(zone.id) ?? 0;
    const prefix = depth > 0 ? `${Array(depth).fill("--").join("")} ` : "";
    return `${prefix}${zone.name}`;
  };

  const currentHousehold = useMemo(
    () => households.find(h => h.id === selectedHouseholdId) || null,
    [households, selectedHouseholdId]
  );

  useEffect(() => {
    const load = async () => {
      setError("");
      setLoading(true);
      setZones([]);
      try {
        if (!selectedHouseholdId) return;
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();
        const { data, error: zErr } = await client
          .from("zones" as any)
          .select("id,name,parent_id,created_by,note,surface")
          .eq("household_id", selectedHouseholdId)
          .order("created_at" as any);
        if (zErr) throw zErr;
        setZones((data as Zone[]) ?? []);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || t('zones.loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedHouseholdId]);

  const handleCreate = async () => {
    setError("");
    if (!selectedHouseholdId) return;
    const name = newName.trim();
    if (!name) return;
    const surfaceTrimmed = newSurface.trim();
    const surfaceValue = surfaceTrimmed ? Number(surfaceTrimmed) : null;
    if (surfaceTrimmed && (Number.isNaN(surfaceValue) || surfaceValue < 0)) {
      setError(t('zones.invalidSurface'));
      return;
    }
    const noteValue = newNote.trim();
    try {
      setCreating(true);
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const { data, error: insErr } = await client
        .from("zones" as any)
        .insert({
          household_id: selectedHouseholdId,
          name,
          parent_id: newParentId || null,
          note: noteValue ? noteValue : null,
          surface: surfaceValue,
        })
        .select("id,name,parent_id,note,surface,created_by")
        .single();
      if (insErr) throw insErr;
      if (data) {
        const created = data as Zone;
        setZones(prev => [...prev, created]);
        setShowNew(false);
        setNewName("");
        setNewParentId("");
        setNewSurface("");
        setNewNote("");
        startEdit(created);
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || t('zones.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (z: Zone) => {
    setEditingId(z.id);
    setEditingName(z.name);
    setEditingParentId(z.parent_id ?? "");
    setEditingSurface(
      typeof z.surface === "number" && !Number.isNaN(z.surface) ? String(z.surface) : ""
    );
    setEditingNote(z.note ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingParentId("");
    setEditingSurface("");
    setEditingNote("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const name = editingName.trim();
    if (!name) return;
    const surfaceTrimmed = editingSurface.trim();
    const surfaceValue = surfaceTrimmed ? Number(surfaceTrimmed) : null;
    if (surfaceTrimmed && (Number.isNaN(surfaceValue) || surfaceValue < 0)) {
      setError(t('zones.invalidSurface'));
      return;
    }
    const noteValue = editingNote.trim();
    try {
      setSavingEdit(true);
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const { error: upErr } = await client
        .from("zones" as any)
        .update({
          name,
          parent_id: editingParentId || null,
          note: noteValue ? noteValue : null,
          surface: surfaceValue,
        })
        .eq("id", editingId);
      if (upErr) throw upErr;
      setZones(prev =>
        prev.map(z =>
          z.id === editingId
            ? {
                ...z,
                name,
                parent_id: editingParentId || null,
                note: noteValue ? noteValue : null,
                surface: surfaceValue,
              }
            : z
        )
      );
      cancelEdit();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || t('zones.updateFailed'));
    } finally {
      setSavingEdit(false);
    }
  };

  const removeZone = async (id: string) => {
    if (!id) return;
    try {
      setDeletingId(id);
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const { error: delErr } = await client
        .from("zones" as any)
        .delete()
        .eq("id", id);
      if (delErr) throw delErr;
      setZones(prev => prev.filter(z => z.id !== id));
    } catch (e: any) {
      console.error(e);
      setError(e?.message || t('zones.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  const formattedSurfaceTotal = zoneStats.hasSurfaceData
    ? numberFormatter.format(zoneStats.surfaceSum)
    : null;

  const statsTiles: Array<{
    key: string;
    icon: LucideIcon;
    iconClass: string;
    label: string;
    value: string;
    helper?: string;
  }> = [
    {
      key: "total",
      icon: Layers,
      iconClass: "text-indigo-600",
      label: t('zones.stats.totalLabel'),
      value: zoneStats.totalCount.toString(),
    },
    {
      key: "root",
      icon: Layers,
      iconClass: "text-emerald-600",
      label: t('zones.stats.rootLabel'),
      value: zoneStats.rootCount.toString(),
      helper:
        zoneStats.childCount > 0
          ? t('zones.stats.nestedHelper', { count: zoneStats.childCount })
          : undefined,
    },
    {
      key: "surface",
      icon: Ruler,
      iconClass: "text-amber-600",
      label: t('zones.stats.surfaceLabel'),
      value:
        zoneStats.hasSurfaceData && formattedSurfaceTotal
          ? t('zones.stats.surfaceValue', { value: formattedSurfaceTotal })
          : '--',
      helper: zoneStats.hasSurfaceData ? undefined : t('zones.stats.surfaceFallback'),
    },
  ];

  if (globalLoading) {
    return (
      <div className="p-6 text-sm text-gray-500">{t('common.loading')}</div>
    );
  }

  if (!selectedHouseholdId) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('zones.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600">
              {t('common.selectHouseholdFirst')}{' '}<Link href="/app" className="underline">{t('nav.dashboard')}</Link>.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Zones {currentHousehold ? `· ${currentHousehold.name}` : ""}</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 text-sm text-red-600 border border-red-200 rounded p-2 bg-red-50">{error}</div>
          )}

          {!loading && sortedZones.length > 0 && (
            <div className="mb-6 grid gap-3 rounded-md border border-gray-200 bg-gray-50 p-4 md:grid-cols-3">
              {statsTiles.map(tile => {
                const Icon = tile.icon;
                return (
                  <div key={tile.key} className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
                      <Icon className={clsx("h-5 w-5", tile.iconClass)} />
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {tile.label}
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {tile.value}
                      </div>
                      {tile.helper ? (
                        <div className="text-xs text-gray-500">{tile.helper}</div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mb-4">
            {showNew ? (
              <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3">
                <div className="flex flex-col gap-2 md:flex-row">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t('zones.placeholder')}
                    className="md:flex-1"
                  />
                  <select
                    value={newParentId}
                    onChange={(e) => setNewParentId(e.target.value)}
                    className="h-10 rounded-md border px-3 text-sm md:w-56"
                  >
                    <option value="">{t('zones.noParent')}</option>
                    {sortedZones.map((z) => (
                      <option key={z.id} value={z.id}>{formatZoneOptionLabel(z)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2 md:flex-row">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newSurface}
                    onChange={(e) => setNewSurface(e.target.value)}
                    placeholder={t('zones.surfacePlaceholder')}
                    className="md:w-48"
                  />
                </div>
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder={t('zones.notePlaceholder')}
                  rows={3}
                />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
                    {creating ? t('common.creating') : t('common.save')}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowNew(false);
                      setNewName("");
                      setNewParentId("");
                      setNewSurface("");
                      setNewNote("");
                    }}
                    disabled={creating}
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={() => setShowNew(true)}>{t('zones.addZone')}</Button>
            )}
          </div>

          {loading ? (
            <div className="text-sm text-gray-500">{t('zones.loading')}</div>
          ) : sortedZones.length === 0 ? (
            <div className="text-sm text-gray-500">{t('zones.none')}</div>
          ) : (
            <ul className="space-y-3">
              {sortedZones.map((z) => {
                const parent = z.parent_id ? zonesById.get(z.parent_id) ?? null : null;
                const surfaceText =
                  typeof z.surface === "number" && !Number.isNaN(z.surface)
                    ? numberFormatter.format(z.surface)
                    : null;
                const depth = zoneDepths.get(z.id) ?? 0;

                return (
                  <li
                    key={z.id}
                    className={clsx(
                      "group rounded-md border px-3 py-3 shadow-sm transition hover:border-gray-300",
                      depth > 0
                        ? "bg-slate-50 border-l-4 border-l-indigo-200"
                        : "border-l-4 border-l-slate-200 bg-white"
                    )}
                    style={depth ? { marginLeft: depth * 12 } : undefined}
                  >
                    {editingId === z.id ? (
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-2 md:flex-row">
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="md:flex-1"
                          />
                          <select
                            value={editingParentId}
                            onChange={(e) => setEditingParentId(e.target.value)}
                            className="h-10 rounded-md border px-3 text-sm md:w-56"
                          >
                            <option value="">{t('zones.noParent')}</option>
                            {sortedZones
                              .filter(zz => zz.id !== z.id)
                              .map(zz => (
                                <option key={zz.id} value={zz.id}>{formatZoneOptionLabel(zz)}</option>
                              ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-2 md:flex-row">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editingSurface}
                            onChange={(e) => setEditingSurface(e.target.value)}
                            placeholder={t('zones.surfacePlaceholder')}
                            className="md:w-48"
                          />
                        </div>
                        <Textarea
                          value={editingNote}
                          onChange={(e) => setEditingNote(e.target.value)}
                          placeholder={t('zones.notePlaceholder')}
                          rows={3}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={saveEdit} disabled={savingEdit || !editingName.trim()}>
                            {savingEdit ? t('common.saving') : t('common.save')}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={cancelEdit} disabled={savingEdit}>
                            {t('common.cancel')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                            <Layers className="h-4 w-4 text-gray-400" />
                            <span>{z.name}</span>
                          </div>
                          {(parent || surfaceText) && (
                            <div className="flex flex-wrap gap-2 text-xs">
                              {parent ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-indigo-700">
                                  <Layers className="h-3 w-3" />
                                  {t('zones.childOf', { parent: parent.name })}
                                </span>
                              ) : null}
                              {surfaceText ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                                  <Ruler className="h-3 w-3" />
                                  {t('zones.surfaceValue', { value: surfaceText })}
                                </span>
                              ) : null}
                            </div>
                          )}
                          {z.note ? (
                            <div className="flex items-start gap-2 text-xs text-gray-600">
                              <StickyNote className="mt-0.5 h-4 w-4 text-gray-400" />
                              <span>{t('zones.noteValue', { note: z.note })}</span>
                            </div>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="secondary"
                            onClick={() => startEdit(z)}
                            aria-label={t('zones.edit')}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="destructive"
                            onClick={() => {
                              setPendingDelete(z);
                              setConfirmOpen(true);
                            }}
                            disabled={deletingId === z.id}
                            aria-label={deletingId === z.id ? t('common.deleting') : t('common.delete')}
                          >
                            {deletingId === z.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      {/* Confirm delete */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(o) => { setConfirmOpen(o); if (!o) setPendingDelete(null); }}
        title={t('zones.deleteConfirmTitle')}
        description={pendingDelete ? t('zones.deleteConfirmDescription', { name: pendingDelete.name }) : undefined}
        confirmText={t('zones.deleteConfirmCta')}
        cancelText={t('zones.deleteCancel')}
        destructive
        loading={!!(pendingDelete && deletingId === pendingDelete.id)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await removeZone(pendingDelete.id);
          setConfirmOpen(false);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
