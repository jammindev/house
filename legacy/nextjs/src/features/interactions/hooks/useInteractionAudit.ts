"use client";

import { useEffect, useState } from "react";

type AuditUser = {
  id: string;
  email: string | null;
  username: string | null;
};

type AuditResponse = {
  created_at: string | null;
  updated_at: string | null;
  created_by: AuditUser | null;
  updated_by: AuditUser | null;
};

export function useInteractionAudit(interactionId?: string, refreshKey?: string | number | null) {
  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!interactionId) return undefined;

    async function load() {
      setLoading(true);
      setError("");
      setAudit(null);
      try {
        const response = await fetch(`/api/interactions/${interactionId}/audit`, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload?.error ?? "Failed to load audit metadata");
        }

        const payload = (await response.json()) as AuditResponse;
        setAudit(payload);
      } catch (error) {
        // If fetch fails (network / server), report it.
        console.error("Failed to load interaction audit metadata:", error);
        setError(error instanceof Error ? error.message : "Failed to load audit metadata");
      } finally {
        setLoading(false);
      }
    }

    load();

    return undefined;
  }, [interactionId, refreshKey]);

  return { audit, loading, error };
}
