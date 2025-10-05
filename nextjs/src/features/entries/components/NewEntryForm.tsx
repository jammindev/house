// src/app/entries/new/NewEntryForm.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useGlobal } from "@/lib/context/GlobalContext";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/I18nProvider";

import { DocumentImportButtons } from "./DocumentImportButtons";
import { ZonePicker } from "./ZonePicker";
import { normalizeZoneSelection } from "../lib/normalizeZoneSelection";
import { ZoneOption } from "../types";

const sectionClass = "rounded-2xl border border-gray-100 bg-white/80 p-4 shadow-sm space-y-3 sm:p-5";

export default function NewEntryForm() {
  const router = useRouter();
  const { loading, households, selectedHouseholdId } = useGlobal();
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [rawText, setRawText] = useState<string>("");
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [newZoneName, setNewZoneName] = useState<string>("");
  const [newZoneParentId, setNewZoneParentId] = useState<string | "">("");
  const [newZoneSurface, setNewZoneSurface] = useState<string>("");
  const [newZoneNote, setNewZoneNote] = useState<string>("");
  const [creatingZone, setCreatingZone] = useState<boolean>(false);
  const [showZoneInput, setShowZoneInput] = useState<boolean>(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);

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
          .select("id,name,parent_id,note,surface")
          .eq("household_id", selectedHouseholdId)
          .order("created_at" as any);
        if (zErr) throw zErr;
        setZones((data as ZoneOption[]) ?? []);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || t("zones.loadFailed"));
      }
    })();
  }, [selectedHouseholdId, t]);

  const handleCreateZone = async () => {
    setError("");
    const name = newZoneName.trim();
    if (!selectedHouseholdId) {
      setError(t("common.noHouseholdSelected"));
      return;
    }
    if (!name) return;
    const surfaceTrimmed = newZoneSurface.trim();
    const surfaceValue = surfaceTrimmed ? Number(surfaceTrimmed) : null;
    if (surfaceTrimmed && (Number.isNaN(surfaceValue) || surfaceValue < 0)) {
      setError(t("zones.invalidSurface"));
      return;
    }
    const noteValue = newZoneNote.trim();
    try {
      setCreatingZone(true);
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const { data, error: insErr } = await client
        .from("zones" as any)
        .insert({
          household_id: selectedHouseholdId,
          name,
          parent_id: newZoneParentId || null,
          note: noteValue ? noteValue : null,
          surface: surfaceValue,
        })
        .select("id,name,parent_id,note,surface")
        .single();
      if (insErr) throw insErr;
      if (data) {
        const createdZone = data as ZoneOption;
        setZones((prev) => {
          const nextZones = [...prev, createdZone];
          setSelectedZoneIds((prevIds) =>
            normalizeZoneSelection([...prevIds, createdZone.id], nextZones)
          );
          return nextZones;
        });
        setNewZoneName("");
        setNewZoneParentId("");
        setNewZoneSurface("");
        setNewZoneNote("");
        setShowZoneInput(false);
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || t("zones.createFailed"));
    } finally {
      setCreatingZone(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!rawText.trim()) {
      setError(t("entries.rawRequired"));
      return;
    }
    if (!selectedHouseholdId) {
      setError(t("common.noHouseholdSelected"));
      return;
    }
    if (selectedZoneIds.length === 0) {
      setError(t("entries.selectZoneRequired"));
      return;
    }

    try {
      setSubmitting(true);
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const { data: userData } = await client.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error(t("auth.notAuthenticated"));

      const { data: rpcId, error: rpcErr } = await client
        .rpc("create_entry_with_zones" as any, {
          p_household_id: selectedHouseholdId,
          p_raw_text: rawText.trim(),
          p_zone_ids: selectedZoneIds,
        });
      if (rpcErr) throw rpcErr;

      const entryId = (rpcId as unknown) as string;
      const uploadedPaths: string[] = [];

      try {
        if (entryId && files.length > 0) {
          setUploading(true);
          for (const f of files) {
            const safeName = f.name.replace(/[^0-9a-zA-Z._-]/g, "_");
            const uid = (globalThis as any).crypto?.randomUUID
              ? (globalThis as any).crypto.randomUUID()
              : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const path = `${userId}/${entryId}/${uid}_${safeName}`;
            const { error: upErr } = await client.storage
              .from("files")
              .upload(path, f, { upsert: false });
            if (upErr) throw upErr;
            uploadedPaths.push(path);
            const { error: linkErr } = await client
              .from("entry_files" as any)
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
      } catch (innerErr) {
        try {
          if (uploadedPaths.length > 0) {
            await client.storage.from("files").remove(uploadedPaths);
          }
        } catch (rmErr) {
          console.warn("Cleanup storage failed", rmErr);
        }
        try {
          if (entryId) {
            await client.from("entries" as any).delete().eq("id", entryId);
          }
        } catch (delErr) {
          console.warn("Cleanup entry failed", delErr);
        }
        throw innerErr;
      }

      return router.push("/app/entries?created=1");
    } catch (e: any) {
      console.error(e);
      setError(e?.message || t("entries.createFailed"));
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-semibold text-gray-900">{t("entries.newEntry")}</CardTitle>
          <p className="text-sm text-gray-500">{t("entries.newEntryIntro")}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="text-sm text-gray-500">{t("common.loading")}</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="text-sm text-red-600 border border-red-200 rounded-lg p-3 bg-red-50">
                  {error}
                  {households.length === 0 && (
                    <span>
                      {" "}
                      <Link href="/app/households/new" className="underline">
                        {t("common.createHousehold")}
                      </Link>
                      .
                    </span>
                  )}
                </div>
              )}
              {success && (
                <div className="text-sm text-green-700 border border-green-200 rounded-lg p-3 bg-green-50">
                  {success}
                </div>
              )}

              <section className={sectionClass}>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-900">{t("entries.rawText")}</label>
                    <p className="text-xs text-gray-500">{t("entries.rawHelper")}</p>
                  </div>
                  <Textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    rows={8}
                    placeholder={t("entries.rawPlaceholder")}
                    required
                    className="min-h-[160px] rounded-xl border-gray-200 bg-white/70"
                  />
                </div>
              </section>

              <section className={sectionClass}>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-gray-900">{t("zones.title")}</label>
                  <p className="text-xs text-gray-500">{t("entries.zoneHelper")}</p>
                </div>
                <div className="flex flex-col gap-3">
                  {showZoneInput ? (
                    <div className="w-full space-y-3 rounded-xl border border-gray-200 bg-gray-50/80 p-4">
                      <div className="flex flex-col gap-2 md:flex-row">
                        <Input
                          value={newZoneName}
                          onChange={(e) => setNewZoneName(e.target.value)}
                          placeholder={t("zones.placeholder")}
                          className="md:flex-1"
                        />
                        <select
                          value={newZoneParentId}
                          onChange={(e) => setNewZoneParentId(e.target.value)}
                          className="h-10 rounded-md border px-3 text-sm md:w-56"
                        >
                          <option value="">{t("zones.noParent")}</option>
                          {zones.map((z) => (
                            <option key={z.id} value={z.id}>
                              {z.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-2 md:flex-row">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={newZoneSurface}
                          onChange={(e) => setNewZoneSurface(e.target.value)}
                          placeholder={t("zones.surfacePlaceholder")}
                          className="md:w-48"
                        />
                      </div>
                      <Textarea
                        value={newZoneNote}
                        onChange={(e) => setNewZoneNote(e.target.value)}
                        placeholder={t("zones.notePlaceholder")}
                        rows={3}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          onClick={handleCreateZone}
                          disabled={creatingZone || !newZoneName.trim()}
                          className="bg-primary-600 text-white hover:bg-primary-700"
                        >
                          {creatingZone ? t("common.adding") : t("common.save")}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => {
                            setShowZoneInput(false);
                            setNewZoneName("");
                            setNewZoneParentId("");
                            setNewZoneSurface("");
                            setNewZoneNote("");
                          }}
                          className="border bg-white text-gray-700 hover:bg-gray-50"
                          disabled={creatingZone}
                        >
                          {t("common.cancel")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => setShowZoneInput(true)}
                      className="self-start rounded-full bg-primary-600 px-4 text-white hover:bg-primary-700"
                    >
                      {t("zones.createNew")}
                    </Button>
                  )}
                </div>
                {zones.length === 0 ? (
                  <div className="text-sm text-gray-500">{t("zones.none")}</div>
                ) : (
                  <ZonePicker
                    zones={zones}
                    value={selectedZoneIds}
                    onChange={setSelectedZoneIds}
                  />
                )}
              </section>

              <section className={sectionClass}>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-900">{t("entries.documents")}</label>
                  <p className="text-xs text-gray-500">{t("entries.documentsHelper")}</p>
                </div>
                <DocumentImportButtons
                  onFilesSelected={(list) =>
                    setFiles((prev) => [...prev, ...list])
                  }
                />
                {files.length > 0 && (
                  <ul className="ml-5 list-disc space-y-1 text-xs text-gray-600">
                    {files.map((f, idx) => (
                      <li key={idx}>
                        {f.name} ({Math.round(f.size / 1024)} KB)
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <Button
                  type="submit"
                  disabled={
                    submitting ||
                    uploading ||
                    households.length === 0 ||
                    !selectedHouseholdId ||
                    selectedZoneIds.length === 0
                  }
                >
                  {submitting || uploading ? t("common.saving") : t("entries.createCta")}
                </Button>
                <Link href="/app/entries" className="text-sm text-gray-600 hover:underline">
                  {t("common.cancel")}
                </Link>
                {households.length === 0 && (
                  <Link href="/app/households/new" className="text-sm text-primary-700 hover:underline">
                    {t("common.createHousehold")}
                  </Link>
                )}
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
