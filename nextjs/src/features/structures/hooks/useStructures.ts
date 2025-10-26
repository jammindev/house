"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import type {
  CreateStructureInput,
  Structure,
  StructureAddress,
  StructureAddressInput,
  StructureEmailInput,
  StructurePhoneInput,
  UpdateStructureInput,
} from "../types";

type RawStructureAddress = {
  id: string;
  address_1?: string | null;
  address_2?: string | null;
  zipcode?: string | null;
  city?: string | null;
  country?: string | null;
  label?: string | null;
  is_primary?: boolean | null;
  created_at?: string | null;
};

type RawStructureEmail = {
  id: string;
  email?: string | null;
  label?: string | null;
  is_primary?: boolean | null;
  created_at?: string | null;
};

type RawStructurePhone = {
  id: string;
  phone?: string | null;
  label?: string | null;
  is_primary?: boolean | null;
  created_at?: string | null;
};

type RawStructure = {
  id: string;
  household_id: string;
  name?: string | null;
  type?: string | null;
  description?: string | null;
  website?: string | null;
  tags?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
  addresses?: RawStructureAddress[] | null;
  emails?: RawStructureEmail[] | null;
  phones?: RawStructurePhone[] | null;
};

const collator = new Intl.Collator(undefined, { sensitivity: "base" });

function normalizeText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizeAddress(data: RawStructureAddress): StructureAddress {
  return {
    id: data.id,
    address_1: normalizeText(data.address_1) ?? "",
    address_2: normalizeText(data.address_2),
    zipcode: normalizeText(data.zipcode),
    city: normalizeText(data.city),
    country: normalizeText(data.country),
    label: normalizeText(data.label),
    is_primary: data.is_primary ?? false,
    created_at: data.created_at ?? null,
  };
}

function normalizeStructure(data: RawStructure): Structure {
  return {
    id: data.id,
    household_id: data.household_id,
    name: normalizeText(data.name) ?? "",
    type: normalizeText(data.type),
    description: normalizeText(data.description),
    website: normalizeText(data.website),
    tags: data.tags ?? [],
    created_at: data.created_at ?? null,
    updated_at: data.updated_at ?? null,
    addresses: data.addresses?.map((address) => normalizeAddress(address as RawStructureAddress)) ?? [],
    emails:
      data.emails?.map((email) => ({
        id: email.id,
        email: normalizeText(email.email) ?? "",
        label: normalizeText(email.label),
        is_primary: email.is_primary ?? false,
        created_at: email.created_at ?? null,
      })) ?? [],
    phones:
      data.phones?.map((phone) => ({
        id: phone.id,
        phone: normalizeText(phone.phone) ?? "",
        label: normalizeText(phone.label),
        is_primary: phone.is_primary ?? false,
        created_at: phone.created_at ?? null,
      })) ?? [],
  };
}

function sortStructures(list: Structure[]) {
  return [...list].sort((a, b) => collator.compare(a.name ?? "", b.name ?? ""));
}

const STRUCTURE_SELECT = `
  id,
  household_id,
  name,
  type,
  description,
  website,
  tags,
  created_at,
  updated_at,
  addresses:addresses!addresses_structure_id_fkey(
    id,
    address_1,
    address_2,
    zipcode,
    city,
    country,
    label,
    is_primary,
    created_at
  ),
  emails:emails!emails_structure_id_fkey(
    id,
    email,
    label,
    is_primary,
    created_at
  ),
  phones:phones!phones_structure_id_fkey(
    id,
    phone,
    label,
    is_primary,
    created_at
  )
`;

function prepareAddressesForInsert(params: {
  addresses?: StructureAddressInput[];
  householdId: string;
  structureId: string;
  userId: string;
}) {
  const { addresses, householdId, structureId, userId } = params;
  if (!addresses?.length) return [];

  return addresses
    .map((address) => ({
      address_1: address.address_1?.trim() ?? "",
      address_2: address.address_2?.trim() ?? "",
      zipcode: address.zipcode?.trim() ?? "",
      city: address.city?.trim() ?? "",
      country: address.country?.trim() ?? "",
      label: address.label?.trim() ?? "",
      is_primary: Boolean(address.is_primary),
    }))
    .filter((address) => address.address_1.length > 0)
    .map((address) => ({
      household_id: householdId,
      structure_id: structureId,
      contact_id: null,
      created_by: userId,
      ...address,
    }));
}

async function replaceStructureAddresses(
  client: SupabaseClient,
  params: {
    addresses?: StructureAddressInput[];
    householdId: string;
    structureId: string;
    userId: string;
  }
) {
  const { addresses, householdId, structureId, userId } = params;
  await client.from("addresses").delete().eq("structure_id", structureId).eq("household_id", householdId);

  const payload = prepareAddressesForInsert({ addresses, householdId, structureId, userId });
  if (payload.length === 0) return;

  const { error } = await client.from("addresses").insert(payload);
  if (error) throw error;
}

function prepareEmailsForInsert(params: {
  emails?: StructureEmailInput[];
  householdId: string;
  structureId: string;
  userId: string;
}) {
  const { emails, householdId, structureId, userId } = params;
  if (!emails?.length) return [];

  return emails
    .map((email) => ({
      email: email.email?.trim() ?? "",
      label: email.label?.trim() ?? "",
      is_primary: Boolean(email.is_primary),
    }))
    .filter((email) => email.email.length > 0)
    .map((email) => ({
      household_id: householdId,
      structure_id: structureId,
      contact_id: null,
      created_by: userId,
      ...email,
    }));
}

async function replaceStructureEmails(
  client: SupabaseClient,
  params: {
    emails?: StructureEmailInput[];
    householdId: string;
    structureId: string;
    userId: string;
  }
) {
  const { emails, householdId, structureId, userId } = params;
  await client.from("emails").delete().eq("structure_id", structureId).eq("household_id", householdId);

  const payload = prepareEmailsForInsert({ emails, householdId, structureId, userId });
  if (payload.length === 0) return;

  const { error } = await client.from("emails").insert(payload);
  if (error) throw error;
}

function preparePhonesForInsert(params: {
  phones?: StructurePhoneInput[];
  householdId: string;
  structureId: string;
  userId: string;
}) {
  const { phones, householdId, structureId, userId } = params;
  if (!phones?.length) return [];

  return phones
    .map((phone) => ({
      phone: phone.phone?.trim() ?? "",
      label: phone.label?.trim() ?? "",
      is_primary: Boolean(phone.is_primary),
    }))
    .filter((phone) => phone.phone.length > 0)
    .map((phone) => ({
      household_id: householdId,
      structure_id: structureId,
      contact_id: null,
      created_by: userId,
      ...phone,
    }));
}

async function replaceStructurePhones(
  client: SupabaseClient,
  params: {
    phones?: StructurePhoneInput[];
    householdId: string;
    structureId: string;
    userId: string;
  }
) {
  const { phones, householdId, structureId, userId } = params;
  await client.from("phones").delete().eq("structure_id", structureId).eq("household_id", householdId);

  const payload = preparePhonesForInsert({ phones, householdId, structureId, userId });
  if (payload.length === 0) return;

  const { error } = await client.from("phones").insert(payload);
  if (error) throw error;
}

export function useStructures() {
  const { selectedHouseholdId: householdId } = useGlobal();
  const { t } = useI18n();
  const [structures, setStructures] = useState<Structure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setError("");
    setLoading(true);
    setStructures([]);
    try {
      if (!householdId) return;

      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const { data, error: fetchError } = await client
        .from("structures")
        .select(STRUCTURE_SELECT)
        .eq("household_id", householdId)
        .order("name", { ascending: true });

      if (fetchError) throw fetchError;

      const normalized = sortStructures((data ?? []).map((row) => normalizeStructure(row as RawStructure)));
      setStructures(normalized);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : t("structures.loadFailed");
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [householdId, t]);

  useEffect(() => {
    reload();
  }, [reload]);

  const createStructure = useCallback(
    async (input: CreateStructureInput) => {
      if (!input.householdId) throw new Error(t("structures.householdRequired"));

      try {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();

        const { data: authData, error: authError } = await client.auth.getUser();
        if (authError) throw authError;
        const userId = authData?.user?.id;
        if (!userId) throw new Error(t("structures.createNoUser"));

        const name = input.name?.trim();
        if (!name) {
          throw new Error(t("structures.nameRequired"));
        }

        const { data: inserted, error: insertError } = await client
          .from("structures")
          .insert({
            household_id: input.householdId,
            name,
            type: input.type?.trim() ?? "",
            description: input.description?.trim() ?? "",
            website: input.website?.trim() ?? "",
            tags: input.tags ?? [],
            created_by: userId,
          })
          .select("id")
          .single();

        if (insertError) throw insertError;

        const structureId = inserted?.id;
        if (!structureId) throw new Error(t("structures.createFailed"));

        const addressPayload = prepareAddressesForInsert({
          addresses: input.addresses,
          householdId: input.householdId,
          structureId,
          userId,
        });
        if (addressPayload.length > 0) {
          const { error: addressError } = await client.from("addresses").insert(addressPayload);
          if (addressError) throw addressError;
        }

        const emailPayload = prepareEmailsForInsert({
          emails: input.emails,
          householdId: input.householdId,
          structureId,
          userId,
        });
        if (emailPayload.length > 0) {
          const { error: emailError } = await client.from("emails").insert(emailPayload);
          if (emailError) throw emailError;
        }

        const phonePayload = preparePhonesForInsert({
          phones: input.phones,
          householdId: input.householdId,
          structureId,
          userId,
        });
        if (phonePayload.length > 0) {
          const { error: phoneError } = await client.from("phones").insert(phonePayload);
          if (phoneError) throw phoneError;
        }

        const { data: refreshed, error: fetchError } = await client
          .from("structures")
          .select(STRUCTURE_SELECT)
          .eq("id", structureId)
          .single();

        if (fetchError) throw fetchError;

        const structure = normalizeStructure(refreshed as RawStructure);
        setStructures((prev) => sortStructures([...prev, structure]));
        return structure;
      } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : t("structures.createFailed");
        throw new Error(message);
      }
    },
    [t]
  );

  const updateStructure = useCallback(
    async (input: UpdateStructureInput) => {
      if (!input.householdId) throw new Error(t("structures.householdRequired"));
      if (!input.structureId) throw new Error(t("structures.notFound"));

      try {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();

        const { data: authData, error: authError } = await client.auth.getUser();
        if (authError) throw authError;
        const userId = authData?.user?.id;
        if (!userId) throw new Error(t("structures.updateNoUser"));

        const name = input.name?.trim();
        if (!name) {
          throw new Error(t("structures.nameRequired"));
        }

        const { error: updateError } = await client
          .from("structures")
          .update({
            name,
            type: input.type?.trim() ?? "",
            description: input.description?.trim() ?? "",
            website: input.website?.trim() ?? "",
            tags: input.tags ?? [],
            updated_by: userId,
          })
          .eq("id", input.structureId)
          .eq("household_id", input.householdId);

        if (updateError) throw updateError;

        await replaceStructureAddresses(client, {
          addresses: input.addresses,
          householdId: input.householdId,
          structureId: input.structureId,
          userId,
        });

        await replaceStructureEmails(client, {
          emails: input.emails,
          householdId: input.householdId,
          structureId: input.structureId,
          userId,
        });

        await replaceStructurePhones(client, {
          phones: input.phones,
          householdId: input.householdId,
          structureId: input.structureId,
          userId,
        });

        const { data: refreshed, error: fetchError } = await client
          .from("structures")
          .select(STRUCTURE_SELECT)
          .eq("id", input.structureId)
          .single();

        if (fetchError) throw fetchError;

        const structure = normalizeStructure(refreshed as RawStructure);
        setStructures((prev) => sortStructures(prev.map((item) => (item.id === structure.id ? structure : item))));
        return structure;
      } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : t("structures.updateFailed");
        throw new Error(message);
      }
    },
    [t]
  );

  const deleteStructure = useCallback(
    async (structureId: string) => {
      if (!structureId) throw new Error(t("structures.notFound"));

      try {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();
        const { error: deleteError } = await client.from("structures").delete().eq("id", structureId);
        if (deleteError) throw deleteError;

        setStructures((prev) => prev.filter((structure) => structure.id !== structureId));
      } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : t("structures.deleteFailed");
        throw new Error(message);
      }
    },
    [t]
  );

  return { structures, loading, error, setError, reload, createStructure, updateStructure, deleteStructure };
}
