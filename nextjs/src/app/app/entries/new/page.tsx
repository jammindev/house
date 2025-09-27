"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useGlobal } from "@/lib/context/GlobalContext";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/I18nProvider";

export default function NewEntryPage() {
  const router = useRouter();
  const { loading, households, selectedHouseholdId } = useGlobal();
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [rawText, setRawText] = useState<string>("");
  const [zones, setZones] = useState<{ id: string; name: string; parent_id?: string | null }[]>([]);
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [newZoneName, setNewZoneName] = useState<string>("");
  const [newZoneParentId, setNewZoneParentId] = useState<string | "">("");
  const [creatingZone, setCreatingZone] = useState<boolean>(false);
  const [showZoneInput, setShowZoneInput] = useState<boolean>(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);

  const currentHousehold = useMemo(
    () => households.find((h) => h.id === selectedHouseholdId) || null,
    [households, selectedHouseholdId]
  );

  useEffect(() => {
    (async () => {
      setError("");
      setZones([]);
      setSelectedZoneIds([]);
      if (!selectedHouseholdId) return;
      try {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();
        const { data, error: zErr } = await client
          .from("zones" as any)
          .select("id,name,parent_id")
          .eq("household_id", selectedHouseholdId)
          .order("created_at" as any);
        if (zErr) throw zErr;
        setZones((data || []) as any);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || t('zones.loadFailed'));
      }
    })();
  }, [selectedHouseholdId]);

  const handleCreateZone = async () => {
    setError("");
    const name = newZoneName.trim();
    if (!selectedHouseholdId) {
      setError(t('common.noHouseholdSelected'));
      return;
    }
    if (!name) return;
    try {
      setCreatingZone(true);
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const { data, error: insErr } = await client
        .from("zones" as any)
        .insert({ household_id: selectedHouseholdId, name, parent_id: newZoneParentId || null })
        .select("id,name,parent_id")
        .single();
      if (insErr) throw insErr;
      if (data) {
        const createdZone = { id: (data as any).id, name: (data as any).name, parent_id: (data as any).parent_id };
        setZones((prev) => {
          const nextZones = [...prev, createdZone];
          setSelectedZoneIds((prevIds) => normalizeZoneSelection([...prevIds, createdZone.id], nextZones));
          return nextZones;
        });
        setNewZoneName("");
        setNewZoneParentId("");
        setShowZoneInput(false);
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || t('zones.createFailed'));
    } finally {
      setCreatingZone(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!rawText.trim()) {
      setError(t('entries.rawRequired'));
      return;
    }
    if (!selectedHouseholdId) {
      setError(t('common.noHouseholdSelected'));
      return;
    }
    if (selectedZoneIds.length === 0) {
      setError(t('entries.selectZoneRequired'));
      return;
    }

    try {
      setSubmitting(true);
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const { data: userData } = await client.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error(t('auth.notAuthenticated'));

      // Create entry with zones atomically via RPC
      const { data: rpcId, error: rpcErr } = await client
        .rpc('create_entry_with_zones' as any, {
          p_household_id: selectedHouseholdId,
          p_raw_text: rawText.trim(),
          p_zone_ids: selectedZoneIds,
        });
      if (rpcErr) throw rpcErr;

      const entryId = rpcId as unknown as string;
      const uploadedPaths: string[] = [];

      try {
        // Upload files and link in entry_files (all-or-nothing)
        if (entryId && files.length > 0) {
          setUploading(true);
          for (const f of files) {
            // Strict sanitize to avoid problematic characters in storage keys
            const safeName = f.name.replace(/[^0-9a-zA-Z._-]/g, "_");
            const uid = (globalThis as any).crypto?.randomUUID ? (globalThis as any).crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const path = `${userId}/${entryId}/${uid}_${safeName}`;
            const { error: upErr } = await client.storage.from('files').upload(path, f, { upsert: false });
            if (upErr) throw upErr;
            uploadedPaths.push(path);
            const { error: linkErr } = await client
              .from('entry_files' as any)
              .insert({
                entry_id: entryId,
                storage_path: path,
                mime_type: f.type,
                metadata: { size: f.size, name: f.name } as any,
                created_by: userId,
              });
            if (linkErr) throw linkErr;
          }
          setFiles([]);
        }

        // Link zones after successful file handling
        // Zones already linked by RPC
      } catch (innerErr) {
        // Rollback: delete uploaded files and the entry row
        try {
          if (uploadedPaths.length > 0) {
            await client.storage.from('files').remove(uploadedPaths);
          }
        } catch (rmErr) {
          console.warn('Cleanup storage failed', rmErr);
        }
        try {
          if (entryId) {
            await client.from('entries' as any).delete().eq('id', entryId);
          }
        } catch (delErr) {
          console.warn('Cleanup entry failed', delErr);
        }
        throw innerErr;
      }

      // Navigate to entries list after success with success flag for toast
      return router.push('/app/entries?created=1');
    } catch (e: any) {
      console.error(e);
      setError(e?.message || t('entries.createFailed'));
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('entries.newEntry')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-gray-500">{t('common.loading')}</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="text-sm text-red-600 border border-red-200 rounded p-2 bg-red-50">
                  {error}
                  {households.length === 0 && (
                    <span>
                      {" "}
                      <Link href="/app/households/new" className="underline">{t('common.createHousehold')}</Link>.
                    </span>
                  )}
                </div>
              )}
              {success && (
                <div className="text-sm text-green-700 border border-green-200 rounded p-2 bg-green-50">{success}</div>
              )}

              <div className="space-y-1">
                <label className="text-sm font-medium">{t('common.household')}</label>
                <div className="w-full border rounded-md h-10 px-3 flex items-center text-sm bg-gray-50">
                  {currentHousehold ? currentHousehold.name : t('common.noHouseholdShort')}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('entries.documents')}</label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => {
                    const list = e.target.files ? Array.from(e.target.files) : [];
                    setFiles(list);
                  }}
                  className="block w-full text-sm"
                />
                {files.length > 0 && (
                  <ul className="text-xs text-gray-600 list-disc ml-5">
                    {files.map((f, idx) => (
                      <li key={idx}>{f.name} ({Math.round(f.size / 1024)} KB)</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('zones.title')}</label>
                <div className="flex items-center gap-2">
                  {showZoneInput ? (
                    <>
                      <Input
                        value={newZoneName}
                        onChange={(e) => setNewZoneName(e.target.value)}
                        placeholder={t('zones.placeholder')}
                      />
                      <select
                        value={newZoneParentId}
                        onChange={(e) => setNewZoneParentId(e.target.value)}
                        className="h-10 px-3 border rounded-md text-sm"
                      >
                        <option value="">{t('zones.noParent')}</option>
                        {zones.map((z) => (
                          <option key={z.id} value={z.id}>{z.name}</option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        onClick={handleCreateZone}
                        disabled={creatingZone || !newZoneName.trim()}
                        className="bg-primary-600 text-white hover:bg-primary-700"
                      >
                        {creatingZone ? t('common.adding') : t('common.save')}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => { setShowZoneInput(false); setNewZoneName(""); }}
                        className="border bg-white text-gray-700 hover:bg-gray-50"
                        disabled={creatingZone}
                      >
                        {t('common.cancel')}
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => setShowZoneInput(true)}
                      className="bg-primary-600 text-white hover:bg-primary-700"
                    >
                      {t('zones.createNew')}
                    </Button>
                  )}
                </div>
                {zones.length === 0 ? (
                  <div className="text-sm text-gray-500">{t('zones.none')}</div>
                ) : (
                  <ZonePicker
                    zones={zones}
                    value={selectedZoneIds}
                    onChange={setSelectedZoneIds}
                  />
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">{t('entries.rawText')}</label>
                <Textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={8}
                  placeholder={t('entries.rawPlaceholder')}
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <Button type="submit" disabled={submitting || uploading || households.length === 0 || !selectedHouseholdId || selectedZoneIds.length === 0}>
                  {submitting || uploading ? t('common.saving') : t('entries.createCta')}
                </Button>
                <Link href="/app/entries" className="text-sm text-gray-600 hover:underline">{t('common.cancel')}</Link>
                {households.length === 0 && (
                  <Link href="/app/households/new" className="text-sm text-primary-700 hover:underline">{t('common.createHousehold')}</Link>
                )}
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ZonePicker({ zones, value, onChange }: { zones: { id: string; name: string; parent_id?: string | null }[]; value: string[]; onChange: React.Dispatch<React.SetStateAction<string[]>> }) {
  const zoneMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; parent_id?: string | null }>();
    zones.forEach(z => map.set(z.id, z));
    return map;
  }, [zones]);

  const childrenMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; parent_id?: string | null }[]>();
    zones.forEach(zone => {
      if (zone.parent_id && zoneMap.has(zone.parent_id)) {
        const list = map.get(zone.parent_id) || [];
        list.push(zone);
        map.set(zone.parent_id, list);
      }
    });
    map.forEach(list => list.sort((a, b) => a.name.localeCompare(b.name)));
    return map;
  }, [zones, zoneMap]);

  const roots = useMemo(() => {
    return zones
      .filter(zone => !zone.parent_id || !zoneMap.has(zone.parent_id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [zones, zoneMap]);

  const getDescendants = useCallback((zoneId: string) => {
    const result: string[] = [];
    const stack = [...(childrenMap.get(zoneId) || [])];
    while (stack.length) {
      const current = stack.pop();
      if (!current) continue;
      result.push(current.id);
      const kids = childrenMap.get(current.id);
      if (kids?.length) {
        stack.push(...kids);
      }
    }
    return result;
  }, [childrenMap]);

  const toggleZone = useCallback((zoneId: string) => {
    const isSelected = value.includes(zoneId);
    const descendants = getDescendants(zoneId);
    let next = value.filter(id => id !== zoneId && !descendants.includes(id));
    if (!isSelected) {
      next = [...next, zoneId];
    }
    onChange(normalizeZoneSelection(next, zones));
  }, [getDescendants, onChange, value, zones]);

  const renderBranch = useCallback((zone: { id: string; name: string; parent_id?: string | null }, depth = 0): React.ReactNode => {
    const isSelected = value.includes(zone.id);
    const children = childrenMap.get(zone.id) || [];
    const wrapperClass = depth === 0
      ? "rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
      : "space-y-2 border-l border-gray-100 pl-4";
    const offsetClass = depth > 0 ? "ml-2" : "";

    return (
      <div key={zone.id} className={`${wrapperClass} ${offsetClass}`}>
        <ZoneToggle
          zone={zone}
          selected={isSelected}
          onToggle={() => toggleZone(zone.id)}
          depth={depth}
        />
        {children.length > 0 ? (
          <div className="mt-2 space-y-2">
            {children.map(child => renderBranch(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  }, [childrenMap, toggleZone, value]);

  const list = roots.length > 0 ? roots : [...zones].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-3">
      {list.map(root => renderBranch(root))}
    </div>
  );
}

function ZoneToggle({ zone, selected, onToggle, depth }: { zone: { id: string; name: string }; selected: boolean; onToggle: () => void; depth: number }) {
  const indicatorClass = selected
    ? "border-primary-500 bg-primary-500 text-white"
    : "border-gray-300 text-transparent group-hover:text-gray-400 group-hover:border-primary-300";

  const baseClass = selected
    ? "border-primary-200 bg-primary-50 text-primary-900 shadow-sm"
    : depth === 0
      ? "border-gray-200 bg-white text-gray-800 hover:border-primary-200 hover:bg-primary-50/40"
      : "border-gray-200 bg-gray-50 text-gray-700 hover:border-primary-200 hover:bg-primary-50/30";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      data-zone-id={zone.id}
      className={`group flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors ${baseClass}`}
    >
      <span className="flex items-center gap-3">
        <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-xs font-semibold transition ${indicatorClass}`}>
          ✓
        </span>
        <span className="flex items-center gap-2">
          {depth > 0 ? <span className="text-gray-400">↳</span> : null}
          <span className={depth === 0 ? "font-medium text-gray-900" : "text-gray-800"}>{zone.name}</span>
        </span>
      </span>
    </button>
  );
}

function normalizeZoneSelection(
  selectedIds: string[],
  zones: { id: string; parent_id?: string | null }[]
): string[] {
  if (selectedIds.length === 0) {
    return [];
  }

  const parentMap = new Map<string, string>();
  for (const zone of zones) {
    if (zone.parent_id) {
      parentMap.set(zone.id, zone.parent_id);
    }
  }

  const result = new Set(selectedIds);
  for (const id of selectedIds) {
    let parentId = parentMap.get(id);
    while (parentId) {
      if (result.has(parentId)) {
        result.delete(parentId);
      }
      parentId = parentMap.get(parentId);
    }
  }

  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const id of selectedIds) {
    if (result.has(id) && !seen.has(id)) {
      ordered.push(id);
      seen.add(id);
    }
  }

  if (ordered.length === result.size) {
    return ordered;
  }

  for (const id of result) {
    if (!seen.has(id)) {
      ordered.push(id);
      seen.add(id);
    }
  }

  return ordered;
}
