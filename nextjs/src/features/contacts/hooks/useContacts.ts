// nextjs/src/features/contacts/hooks/useContacts.ts
"use client";

import { useCallback, useEffect, useState } from "react";

import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type {
  Contact,
  ContactAddress,
  ContactEmail,
  ContactPhone,
  ContactStructure,
  CreateContactInput,
} from "../types";
import { useGlobal } from "@/lib/context/GlobalContext";

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

const CONTACT_SELECT = `
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
`;

const collator = new Intl.Collator(undefined, { sensitivity: "base" });

function normalizeBoolean(value?: boolean | null) {
  return value === true;
}

function normalizeText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizeContact(data: RawContact): Contact {
  return {
    id: data.id,
    household_id: data.household_id,
    structure_id: data.structure_id ?? null,
    first_name: normalizeText(data.first_name) ?? "",
    last_name: normalizeText(data.last_name) ?? "",
    position: normalizeText(data.position),
    notes: normalizeText(data.notes),
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

function sortContacts(list: Contact[]) {
  return [...list].sort((a, b) => {
    const last = collator.compare(a.last_name ?? "", b.last_name ?? "");
    if (last !== 0) return last;
    return collator.compare(a.first_name ?? "", b.first_name ?? "");
  });
}

export function useContacts() {
  const { selectedHouseholdId: householdId } = useGlobal();

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
      const { data, error: contactError } = await client.from("contacts").select(CONTACT_SELECT).eq("household_id", householdId);

      if (contactError) throw contactError;

      const normalized = sortContacts((data ?? []).map((item) => normalizeContact(item as RawContact)));
      setContacts(normalized);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || t("contacts.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [householdId, t]);

  const createContact = useCallback(
    async (input: CreateContactInput) => {
      if (!input.householdId) throw new Error(t("contacts.householdRequired"));

      try {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();

        const { data: authData, error: authError } = await client.auth.getUser();
        if (authError) throw authError;
        const userId = authData?.user?.id;
        if (!userId) throw new Error(t("contacts.createNoUser"));

        const firstName = input.firstName?.trim() ?? "";
        const lastName = input.lastName?.trim() ?? "";
        if (!firstName && !lastName) {
          throw new Error(t("contacts.nameRequired"));
        }

        const { data: insertedContact, error: contactError } = await client
          .from("contacts")
          .insert({
            household_id: input.householdId,
            structure_id: null,
            first_name: firstName,
            last_name: lastName,
            position: input.position?.trim() ?? "",
            notes: input.notes?.trim() ?? "",
            created_by: userId,
          })
          .select("id")
          .single();

        if (contactError) throw contactError;
        const contactId = insertedContact?.id;
        if (!contactId) throw new Error(t("contacts.createFailed"));

        if (input.email?.email?.trim()) {
          const { error: emailError } = await client
            .from("emails")
            .insert({
              household_id: input.householdId,
              contact_id: contactId,
              email: input.email.email.trim(),
              label: input.email.label?.trim() ?? "",
              is_primary: input.email.is_primary ?? true,
              created_by: userId,
            })
            .select("id")
            .single();
          if (emailError) throw emailError;
        }

        if (input.phone?.phone?.trim()) {
          const { error: phoneError } = await client
            .from("phones")
            .insert({
              household_id: input.householdId,
              contact_id: contactId,
              phone: input.phone.phone.trim(),
              label: input.phone.label?.trim() ?? "",
              is_primary: input.phone.is_primary ?? true,
              created_by: userId,
            })
            .select("id")
            .single();
          if (phoneError) throw phoneError;
        }

        const { data: refreshedContact, error: fetchError } = await client
          .from("contacts")
          .select(CONTACT_SELECT)
          .eq("id", contactId)
          .single();

        if (fetchError) throw fetchError;

        const contact = normalizeContact(refreshedContact as RawContact);
        setContacts((prev) => sortContacts([...prev, contact]));

        return contact;
      } catch (e: any) {
        console.error(e);
        throw new Error(e?.message || t("contacts.createFailed"));
      }
    },
    [t]
  );

  useEffect(() => {
    reload();
  }, [reload]);

  return { contacts, loading, error, setError, reload, createContact };
}
