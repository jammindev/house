"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

type Zone = { id: string; name: string };

export default function ZonesPage() {
  const { loading: globalLoading, selectedHouseholdId, households } = useGlobal();
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const [showNew, setShowNew] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>("");
  const [creating, setCreating] = useState<boolean>(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
          .select("id,name")
          .eq("household_id", selectedHouseholdId)
          .order("created_at" as any);
        if (zErr) throw zErr;
        setZones((data || []) as any);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || "Failed to load zones");
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
    try {
      setCreating(true);
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const { data, error: insErr } = await client
        .from("zones" as any)
        .insert({ household_id: selectedHouseholdId, name })
        .select("id,name")
        .single();
      if (insErr) throw insErr;
      if (data) {
        setZones(prev => [...prev, data as any]);
        setShowNew(false);
        setNewName("");
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to create zone");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (z: Zone) => {
    setEditingId(z.id);
    setEditingName(z.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const name = editingName.trim();
    if (!name) return;
    try {
      setSavingEdit(true);
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const { error: upErr } = await client
        .from("zones" as any)
        .update({ name })
        .eq("id", editingId);
      if (upErr) throw upErr;
      setZones(prev => prev.map(z => (z.id === editingId ? { ...z, name } : z)));
      cancelEdit();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to update zone");
    } finally {
      setSavingEdit(false);
    }
  };

  const removeZone = async (id: string) => {
    if (!id) return;
    if (!window.confirm("Delete this zone? This cannot be undone.")) return;
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
      setError(e?.message || "Failed to delete zone");
    } finally {
      setDeletingId(null);
    }
  };

  if (globalLoading) {
    return (
      <div className="p-6 text-sm text-gray-500">Loading…</div>
    );
  }

  if (!selectedHouseholdId) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Zones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600">
              Select or create a household first on the <Link href="/app" className="underline">dashboard</Link>.
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

          <div className="flex items-center gap-2 mb-4">
            {showNew ? (
              <>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Kitchen, Garage, Garden"
                />
                <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
                  {creating ? "Creating…" : "Save"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => { setShowNew(false); setNewName(""); }}
                  disabled={creating}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button onClick={() => setShowNew(true)}>Add Zone</Button>
            )}
          </div>

          {loading ? (
            <div className="text-sm text-gray-500">Loading zones…</div>
          ) : zones.length === 0 ? (
            <div className="text-sm text-gray-500">No zones yet.</div>
          ) : (
            <ul className="space-y-2">
              {zones.map((z) => (
                <li key={z.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                  {editingId === z.id ? (
                    <div className="flex-1 flex items-center gap-2">
                      <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                    </div>
                  ) : (
                    <div className="flex-1 text-sm font-medium">{z.name}</div>
                  )}
                  <div className="flex items-center gap-2">
                    {editingId === z.id ? (
                      <>
                        <Button size="sm" onClick={saveEdit} disabled={savingEdit || !editingName.trim()}>
                          {savingEdit ? "Saving…" : "Save"}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={cancelEdit} disabled={savingEdit}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => startEdit(z)}>Rename</Button>
                        <Button size="sm" variant="destructive" onClick={() => removeZone(z.id)} disabled={deletingId === z.id}>
                          {deletingId === z.id ? "Deleting…" : "Delete"}
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

