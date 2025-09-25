"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Paperclip } from "lucide-react";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { useSearchParams, useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";

type Entry = { id: string; raw_text: string; created_at: string };
type EntryFile = { id: string; entry_id: string; storage_path: string; mime_type: string | null };
type Preview = { url: string; kind: 'image' | 'pdf' };

export default function EntriesHome() {
  const { loading: globalLoading, selectedHouseholdId, households } = useGlobal();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [filesByEntry, setFilesByEntry] = useState<Record<string, EntryFile[]>>({});
  const [previews, setPreviews] = useState<Record<string, Preview>>({});
  const [fileCounts, setFileCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const searchParams = useSearchParams();
  const router = useRouter();
  const { show } = useToast();

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
          const counts: Record<string, number> = {};
          Object.keys(grouped).forEach(k => counts[k] = grouped[k].length);
          setFileCounts(counts);

          // No inline previews on list per request
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

  useEffect(() => {
    if (searchParams?.get('created') === '1') {
      // scrub the param
      const sp = new URLSearchParams(searchParams as any);
      sp.delete('created');
      const next = `/app/entries${sp.toString() ? `?${sp.toString()}` : ''}`;
      router.replace(next, { scroll: false });
      show({ title: 'Entry created successfully', variant: 'success' });
    }
  }, [searchParams, router, show]);

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
            return (
              <li key={e.id}>
                <Link
                  href={`/app/entries/${e.id}`}
                  className="block border rounded-lg p-4 bg-white flex gap-4 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-500">{new Date(e.created_at).toLocaleString()}</div>
                      {fileCounts[e.id] ? (
                        <div className="flex items-center gap-1 text-gray-600" title="Attachments">
                          <Paperclip className="w-4 h-4" />
                          <span className="text-xs">{fileCounts[e.id]}</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="block mt-1 text-gray-900 line-clamp-3 whitespace-pre-wrap">
                      {e.raw_text}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
