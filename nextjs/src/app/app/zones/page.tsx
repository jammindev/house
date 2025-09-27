"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useI18n } from "@/lib/i18n/I18nProvider";

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
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>{z.name}</option>
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
          ) : zones.length === 0 ? (
            <div className="text-sm text-gray-500">{t('zones.none')}</div>
          ) : (
            <ul className="space-y-2">
              {zones.map((z) => {
                const parent = z.parent_id ? zones.find(zz => zz.id === z.parent_id) : null;
                const surfaceText = typeof z.surface === "number" && !Number.isNaN(z.surface)
                  ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(z.surface)
                  : null;

                return (
                  <li key={z.id} className="rounded-md border px-3 py-3">
                    {editingId === z.id ? (
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-2 md:flex-row">
                          <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="md:flex-1" />
                          <select
                            value={editingParentId}
                            onChange={(e) => setEditingParentId(e.target.value)}
                            className="h-10 rounded-md border px-3 text-sm md:w-56"
                          >
                            <option value="">{t('zones.noParent')}</option>
                            {zones.filter(zz => zz.id !== z.id).map(zz => (
                              <option key={zz.id} value={zz.id}>{zz.name}</option>
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
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {z.name}
                            {parent ? (
                              <span className="ml-2 text-xs text-gray-500">
                                {t('zones.childOf', { parent: parent.name })}
                              </span>
                            ) : null}
                          </div>
                          {(surfaceText || z.note) ? (
                            <div className="mt-1 space-y-1 text-xs text-gray-600">
                              {surfaceText ? <div>{t('zones.surfaceValue', { value: surfaceText })}</div> : null}
                              {z.note ? <div>{t('zones.noteValue', { note: z.note })}</div> : null}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="secondary" onClick={() => startEdit(z)}>{t('zones.rename')}</Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => { setPendingDelete(z); setConfirmOpen(true); }}
                            disabled={deletingId === z.id}
                          >
                            {deletingId === z.id ? t('common.deleting') : t('common.delete')}
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
        title="Delete zone?"
        description={pendingDelete ? `This will permanently delete "${pendingDelete.name}". Links to entries will be removed.` : undefined}
        confirmText="Delete"
        cancelText="Cancel"
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
