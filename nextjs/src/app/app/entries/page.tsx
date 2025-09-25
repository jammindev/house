"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";

type Entry = { id: string; raw_text: string; created_at: string };
type EntryFile = { id: string; entry_id: string; storage_path: string; mime_type: string | null };
type Preview = { url: string; kind: 'image' | 'pdf' };

export default function EntriesHome() {
  const { loading: globalLoading, selectedHouseholdId, households } = useGlobal();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [filesByEntry, setFilesByEntry] = useState<Record<string, EntryFile[]>>({});
  const [previews, setPreviews] = useState<Record<string, Preview>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const currentHousehold = useMemo(
    () => households.find(h => h.id === selectedHouseholdId) || null,
    [households, selectedHouseholdId]
  );

  useEffect(() => {
    const load = async () => {
      setError("");
      setLoading(true);
      setEntries([]);
      setFilesByEntry({});
      setPreviews({});
      try {
        if (!selectedHouseholdId) return;
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();
        const { data: eData, error: eErr } = await client
          .from('entries' as any)
          .select('id, raw_text, created_at')
          .eq('household_id', selectedHouseholdId)
          .order('created_at' as any, { ascending: false })
          .limit(50);
        if (eErr) throw eErr;
        const list = (eData || []) as any[];
        setEntries(list as Entry[]);
        const ids = list.map(e => e.id);
        if (ids.length > 0) {
          const { data: fData, error: fErr } = await client
            .from('entry_files' as any)
            .select('id, entry_id, storage_path, mime_type')
            .in('entry_id', ids);
          if (fErr) throw fErr;
          const grouped: Record<string, EntryFile[]> = {};
          (fData || []).forEach((f: any) => {
            const arr = grouped[f.entry_id] || [];
            arr.push(f as EntryFile);
            grouped[f.entry_id] = arr;
          });
          setFilesByEntry(grouped);

          // Build previews for image files
          const previewMap: Record<string, Preview> = {};
          for (const eid of Object.keys(grouped)) {
            const files = grouped[eid];
            const firstImage = files.find(ff => (ff.mime_type || '').startsWith('image/'));
            const firstPdf = files.find(ff => (ff.mime_type || '').toLowerCase() === 'application/pdf');
            if (firstImage) {
              const { data: signed } = await client.storage.from('files').createSignedUrl(firstImage.storage_path, 60);
              if (signed?.signedUrl) previewMap[eid] = { url: signed.signedUrl, kind: 'image' };
            } else if (firstPdf) {
              const { data: signed } = await client.storage.from('files').createSignedUrl(firstPdf.storage_path, 60);
              if (signed?.signedUrl) previewMap[eid] = { url: signed.signedUrl, kind: 'pdf' };
            }
          }
          setPreviews(previewMap);
        }
      } catch (e: any) {
        console.error(e);
        setError(e?.message || 'Failed to load entries');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedHouseholdId]);

  if (globalLoading) {
    return <div className="p-6 text-sm text-gray-500">Loading…</div>;
  }

  if (!selectedHouseholdId) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Entries</CardTitle>
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
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Entries {currentHousehold ? `· ${currentHousehold.name}` : ''}</h1>
        <Link href="/app/entries/new">
          <Button>New Entry</Button>
        </Link>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 border border-red-200 rounded p-2 bg-red-50">{error}</div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Loading entries…</div>
      ) : entries.length === 0 ? (
        <div className="text-sm text-gray-500">No entries yet.</div>
      ) : (
        <ul className="space-y-3">
          {entries.map((e) => {
            const files = filesByEntry[e.id] || [];
            const preview = previews[e.id];
            const firstFile = files[0];
            return (
              <li key={e.id} className="border rounded-lg p-4 bg-white flex gap-4">
                {preview ? (
                  preview.kind === 'image' ? (
                    <img src={preview.url} alt="preview" className="w-24 h-24 object-cover rounded-md border" />
                  ) : (
                    <iframe src={`${preview.url}#toolbar=0&navpanes=0&scrollbar=0`} title="PDF preview" className="w-24 h-24 rounded-md border bg-white" />
                  )
                ) : firstFile ? (
                  <div className="w-24 h-24 flex items-center justify-center rounded-md border text-xs text-gray-600">
                    {firstFile.mime_type || 'file'}
                  </div>
                ) : (
                  <div className="w-24 h-24 flex items-center justify-center rounded-md border text-xs text-gray-400">
                    No file
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-500">{new Date(e.created_at).toLocaleString()}</div>
                  <div className="mt-1 text-gray-900 line-clamp-3 whitespace-pre-wrap">
                    {e.raw_text}
                  </div>
                  {files.length > 0 && (
                    <div className="mt-2 text-xs text-gray-600">
                      {files.length} file{files.length > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
