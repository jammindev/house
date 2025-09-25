"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useGlobal } from "@/lib/context/GlobalContext";
import { Input } from "@/components/ui/input";

export default function NewEntryPage() {
  const { loading, households, selectedHouseholdId } = useGlobal();
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [rawText, setRawText] = useState<string>("");
  const [zones, setZones] = useState<{ id: string; name: string }[]>([]);
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
          .select("id,name")
          .eq("household_id", selectedHouseholdId)
          .order("created_at" as any);
        if (zErr) throw zErr;
        setZones((data || []) as any);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || "Failed to load zones");
      }
    })();
  }, [selectedHouseholdId]);

  const handleCreateZone = async () => {
    setError("");
    const name = newZoneName.trim();
    if (!selectedHouseholdId) {
      setError("No household selected. Go to dashboard to select or create one.");
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
        .select("id,name")
        .single();
      if (insErr) throw insErr;
      if (data) {
        setZones((prev) => [...prev, { id: (data as any).id, name: (data as any).name }]);
        setSelectedZoneIds((prev) => [...prev, (data as any).id]);
        setNewZoneName("");
        setNewZoneParentId("");
        setShowZoneInput(false);
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to create zone");
    } finally {
      setCreatingZone(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!rawText.trim()) {
      setError("Raw text is required");
      return;
    }
    if (!selectedHouseholdId) {
      setError("No household selected. Go to dashboard to select or create one.");
      return;
    }

    try {
      setSubmitting(true);
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const { data: userData } = await client.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const payload: any = {
        household_id: selectedHouseholdId,
        raw_text: rawText.trim(),
        created_by: userId,
      };

      const { data, error: insErr } = await client
        .from("entries" as any)
        .insert(payload)
        .select("id")
        .single();
      if (insErr) throw insErr;

      const entryId = data?.id as string;
      const uploadedPaths: string[] = [];

      try {
        // Upload files and link in entry_files (all-or-nothing)
        if (entryId && files.length > 0) {
          setUploading(true);
          for (const f of files) {
            const safeName = f.name.replace(/[^0-9a-zA-Z!\-_. *'()]/g, "_");
            const path = `${userId}/${entryId}/${Date.now()}_${safeName}`;
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
        if (entryId && selectedZoneIds.length > 0) {
          const rows = selectedZoneIds.map((zone_id) => ({ entry_id: entryId, zone_id }));
          const { error: ezErr } = await client.from("entry_zones" as any).insert(rows);
          if (ezErr) throw ezErr;
        }
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

      setSuccess("Entry created successfully.");
      setRawText("");
      setSelectedZoneIds([]);
      // Optionally navigate to entry detail once it exists
      // router.push(`/entries/${data?.id}`)
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to create entry");
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>New Entry</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="text-sm text-red-600 border border-red-200 rounded p-2 bg-red-50">
                  {error}
                  {households.length === 0 && (
                    <span>
                      {" "}
                      <Link href="/app/households/new" className="underline">Create a household</Link>.
                    </span>
                  )}
                </div>
              )}
              {success && (
                <div className="text-sm text-green-700 border border-green-200 rounded p-2 bg-green-50">{success}</div>
              )}

              <div className="space-y-1">
                <label className="text-sm font-medium">Household</label>
                <div className="w-full border rounded-md h-10 px-3 flex items-center text-sm bg-gray-50">
                  {currentHousehold ? currentHousehold.name : 'No household selected'}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Documents</label>
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
                <label className="text-sm font-medium">Zones</label>
                <div className="flex items-center gap-2">
                  {showZoneInput ? (
                    <>
                      <Input
                        value={newZoneName}
                        onChange={(e) => setNewZoneName(e.target.value)}
                        placeholder="e.g., Kitchen, Garage, Garden"
                      />
                      <select
                        value={newZoneParentId}
                        onChange={(e) => setNewZoneParentId(e.target.value)}
                        className="h-10 px-3 border rounded-md text-sm"
                      >
                        <option value="">No parent</option>
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
                        {creatingZone ? "Adding…" : "Save"}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => { setShowZoneInput(false); setNewZoneName(""); }}
                        className="border bg-white text-gray-700 hover:bg-gray-50"
                        disabled={creatingZone}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => setShowZoneInput(true)}
                      className="bg-primary-600 text-white hover:bg-primary-700"
                    >
                      Create new zone
                    </Button>
                  )}
                </div>
                {zones.length === 0 ? (
                  <div className="text-sm text-gray-500">No zones in this household yet.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {zones.map((z) => {
                      const checked = selectedZoneIds.includes(z.id);
                      return (
                        <label key={z.id} className="flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer hover:bg-gray-50">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={checked}
                            onChange={(e) => {
                              setSelectedZoneIds((prev) => {
                                if (e.target.checked) return [...prev, z.id];
                                return prev.filter((id) => id !== z.id);
                              });
                            }}
                          />
                          <span className="text-sm">{z.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Raw Text</label>
                <Textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={8}
                  placeholder="Write your entry here…"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <Button type="submit" disabled={submitting || uploading || households.length === 0 || !selectedHouseholdId}>
                  {submitting || uploading ? "Saving…" : "Create Entry"}
                </Button>
                <Link href="/app/entries" className="text-sm text-gray-600 hover:underline">Cancel</Link>
                {households.length === 0 && (
                  <Link href="/app/households/new" className="text-sm text-primary-700 hover:underline">Create a household</Link>
                )}
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
