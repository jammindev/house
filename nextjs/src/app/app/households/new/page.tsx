"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function NewHouseholdPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Household name is required");
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch("/api/households", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to create household");
      }
      router.push("app/entries/new");
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to create household");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>New Household</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="text-sm text-red-600 border border-red-200 rounded p-2 bg-red-50 mb-3">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., The Johnsons"
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={submitting} className="bg-primary-600 text-white hover:bg-primary-700">
                {submitting ? "Creating…" : "Create Household"}
              </Button>
              <Link href="/app" className="text-sm text-gray-600 hover:underline">Cancel</Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
