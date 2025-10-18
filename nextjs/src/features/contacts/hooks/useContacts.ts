"use client";

import { useCallback, useEffect, useState } from "react";

import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Contact, ContactAddress, ContactEmail, ContactPhone, ContactStructure } from "../types";

type RawContact = {
  id: string;
  household_id: string;
  structure_id?: string | null;
  first_name: string;
  last_name: string;
  position?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  structure?: ContactStructure | null;
  emails?: ContactEmail[] | null;
  phones?: ContactPhone[] | null;
  addresses?: ContactAddress[] | null;
};

function normalizeBoolean(value?: boolean | null) {
  return value === true;
}

function normalizeContact(data: RawContact): Contact {
  return {
    id: data.id,
    household_id: data.household_id,
    structure_id: data.structure_id ?? null,
    first_name: data.first_name,
    last_name: data.last_name,
    position: data.position ?? null,
    notes: data.notes ?? null,
    created_at: data.created_at ?? null,
    updated_at: data.updated_at ?? null,
    structure: data.structure ?? null,
    emails:
      data.emails?.map((email) => ({
        ...email,
        label: email.label ?? null,
        is_primary: normalizeBoolean(email.is_primary),
        created_at: email.created_at ?? null,
      })) ?? [],
    phones:
      data.phones?.map((phone) => ({
        ...phone,
        label: phone.label ?? null,
        is_primary: normalizeBoolean(phone.is_primary),
        created_at: phone.created_at ?? null,
      })) ?? [],
    addresses:
      data.addresses?.map((address) => ({
        ...address,
        address_2: address.address_2 ?? null,
        zipcode: address.zipcode ?? null,
        city: address.city ?? null,
        country: address.country ?? null,
        label: address.label ?? null,
        is_primary: normalizeBoolean(address.is_primary),
        created_at: address.created_at ?? null,
      })) ?? [],
  };
}

export function useContacts(householdId?: string | null) {
  const { t } = useI18n();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setError("");
    setLoading(true);
    setContacts([]);
    try {
      if (!householdId) return;

      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const { data, error: contactError } = await client
        .from("contacts")
        .select(
          `
            id,
            household_id,
            structure_id,
            first_name,
            last_name,
            position,
            notes,
            created_at,
            updated_at,
            structure:structures!contacts_structure_id_fkey(
              id,
              name,
              type
            ),
            emails:emails(
              id,
              email,
              label,
              is_primary,
              created_at
            ),
            phones:phones(
              id,
              phone,
              label,
              is_primary,
              created_at
            ),
            addresses:addresses(
              id,
              address_1,
              address_2,
              zipcode,
              city,
              country,
              label,
              is_primary,
              created_at
            )
          `
        )
        .eq("household_id", householdId)
        .order("last_name" as any, { ascending: true })
        .order("first_name" as any, { ascending: true });

      if (contactError) throw contactError;

      const normalized = (data ?? []).map((item) => normalizeContact(item as RawContact));
      setContacts(normalized);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || t("contacts.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [householdId, t]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { contacts, loading, error, setError, reload };
}
