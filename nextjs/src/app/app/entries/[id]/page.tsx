"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Entry = { id: string; raw_text: string; created_at: string; household_id: string; created_by?: string };
type EntryFile = { id: string; storage_path: string; mime_type: string | null; created_by?: string };
type Zone = { id: string; name: string };

export default function EntryDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;
  const router = useRouter();
  const { loading: globalLoading, selectedHouseholdId, user } = useGlobal();
  const { t } = useI18n();

  const [entry, setEntry] = useState<Entry | null>(null);
  const [files, setFiles] = useState<(EntryFile & { url?: string })[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [confirmDeleteEntryOpen, setConfirmDeleteEntryOpen] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState(false);
  const [confirmDeleteFileOpen, setConfirmDeleteFileOpen] = useState(false);
  const [pendingFileId, setPendingFileId] = useState<string | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      setError("");
      try {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();
        // Load entry
        const { data: e, error: eErr } = await client
          .from('entries' as any)
          .select('id, raw_text, created_at, household_id, created_by')
          .eq('id', id)
          .single();
        if (eErr) throw eErr;
        setEntry(e as any);

        // Load zones
        const { data: z, error: zErr } = await client
          .from('entry_zones' as any)
          .select('zones:zone_id(id,name)')
          .eq('entry_id', id);
        if (zErr) {
          console.warn('zones load error', zErr);
        } else {
          const list: Zone[] = (z || []).map((r: any) => r.zones).filter(Boolean);
          setZones(list);
        }

        // Load files
        const { data: fData, error: fErr } = await client
          .from('entry_files' as any)
          .select('id, storage_path, mime_type, created_by')
          .eq('entry_id', id);
        if (fErr) throw fErr;
        const arr = (fData || []) as any[];
        const out: (EntryFile & { url?: string })[] = [];
        for (const f of arr) {
          const { data: signed, error: sErr } = await client.storage.from('files').createSignedUrl(f.storage_path, 300);
          if (sErr) {
            console.warn('signed url error', sErr);
            out.push(f);
          } else {
            out.push({ ...f, url: signed?.signedUrl });
          }
        }
        setFiles(out);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || t('entries.loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (globalLoading || loading) {
    return <div className="p-6 text-sm text-gray-500">{t('common.loading')}</div>;
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('entries.entry')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-red-600 border border-red-200 rounded p-2 bg-red-50">{error}</div>
            <div className="mt-4">
              <Button variant="secondary" onClick={() => router.back()}>{t('common.back')}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!entry) return null;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('entries.detail')}</h1>
        <div className="flex items-center gap-2">
          <Button variant="destructive" onClick={() => setConfirmDeleteEntryOpen(true)}>{t('entries.deleteEntry')}</Button>
          <Link href="/app/entries"><Button variant="secondary">{t('common.backToList')}</Button></Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-gray-600">{new Date(entry.created_at).toLocaleString()}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-wrap text-gray-900">{entry.raw_text}</div>
          {zones.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {zones.map(z => (
                <span key={z.id} className="px-2 py-1 text-xs rounded bg-gray-100 border">{z.name}</span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('entries.attachments')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4">
              {files.map((f) => {
                const mt = (f.mime_type || '').toLowerCase();
                const isImg = mt.startsWith('image/');
                const isPdf = mt === 'application/pdf';
                const canDelete = !!user?.id && (!!f.created_by && f.created_by === user.id);
                return (
                  <div key={f.id} className="border rounded-md p-2">
                    {isImg && f.url ? (
                      <img loading="lazy" src={f.url} alt={f.storage_path} className="w-full h-64 object-contain bg-white rounded" />
                    ) : isPdf && f.url ? (
                      <iframe src={`${f.url}#toolbar=1`} className="w-full h-64 bg-white rounded" title={t('entries.pdfPreview')}></iframe>
                    ) : (
                      <div className="text-sm text-gray-600">{f.mime_type || t('common.file')}</div>
                    )}
                    {f.url && (
                      <div className="mt-2 flex items-center gap-2">
                        <a href={f.url} target="_blank" rel="noreferrer" className="text-sm text-primary-700 underline">{t('common.open')}</a>
                        {canDelete && (
                          <Button size="sm" variant="destructive" onClick={() => { setPendingFileId(f.id); setConfirmDeleteFileOpen(true); }}>
                            {t('common.delete')}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
      <ConfirmDialog
        open={confirmDeleteEntryOpen}
        onOpenChange={setConfirmDeleteEntryOpen}
        title={t('entries.confirmDeleteTitle')}
        description={t('entries.confirmDeleteDesc')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        destructive
        loading={deletingEntry}
        onConfirm={async () => {
          try {
            setDeletingEntry(true);
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();
            // Remove storage files uploaded by current user (owner-only policy)
            const myPaths = files.filter((f) => f.created_by === user?.id).map((f) => f.storage_path);
            if (myPaths.length > 0) {
              await client.storage.from('files').remove(myPaths);
            }
            await client.from('entries' as any).delete().eq('id', id);
            setConfirmDeleteEntryOpen(false);
            window.location.href = '/app/entries';
          } catch (e) {
            console.error(e);
          } finally {
            setDeletingEntry(false);
          }
        }}
      />

      <ConfirmDialog
        open={confirmDeleteFileOpen}
        onOpenChange={(o) => { setConfirmDeleteFileOpen(o); if (!o) setPendingFileId(null); }}
        title={t('entries.deleteFileTitle')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        destructive
        loading={!!(deletingFileId && pendingFileId === deletingFileId)}
        onConfirm={async () => {
          const file = files.find(f => f.id === pendingFileId);
          if (!file) return;
          try {
            setDeletingFileId(file.id);
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();
            await client.storage.from('files').remove([file.storage_path]);
            await client.from('entry_files' as any).delete().eq('id', file.id);
            setFiles(prev => prev.filter(f => f.id !== file.id));
          } catch (e) {
            console.error(e);
          } finally {
            setDeletingFileId(null);
            setPendingFileId(null);
            setConfirmDeleteFileOpen(false);
          }
        }}
      />
    </div>
  );
}
