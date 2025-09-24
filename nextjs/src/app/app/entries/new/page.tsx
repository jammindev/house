"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useGlobal } from "@/lib/context/GlobalContext";

export default function NewEntryPage() {
  const { loading, households, selectedHouseholdId } = useGlobal();
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [rawText, setRawText] = useState<string>("");

  const currentHousehold = useMemo(
    () => households.find((h) => h.id === selectedHouseholdId) || null,
    [households, selectedHouseholdId]
  );

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

      const { data, error: insErr } = await client.from("entries" as any).insert(payload).select("id").single();
      if (insErr) throw insErr;

      setSuccess("Entry created successfully.");
      setRawText("");
      // Optionally navigate to entry detail once it exists
      // router.push(`/entries/${data?.id}`)
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to create entry");
    } finally {
      setSubmitting(false);
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
                <Button type="submit" disabled={submitting || households.length === 0 || !selectedHouseholdId} className="bg-primary-600 text-white hover:bg-primary-700">
                  {submitting ? "Creating…" : "Create Entry"}
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
