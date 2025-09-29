import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type TestUserContext = {
  email: string;
  password: string;
  userId: string;
  householdId: string;
  householdName: string;
};

export type TestZone = {
  id: string;
  name: string;
};

export type HouseholdMemberContext = TestUserContext;

type EntryRecord = {
  id: string;
};

let adminClient: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient {
  if (adminClient) {
    return adminClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.PRIVATE_SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and PRIVATE_SUPABASE_SERVICE_KEY must be set for e2e tests.'
    );
  }

  adminClient = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { 'X-Client-Info': 'playwright-tests' },
    },
  });

  return adminClient;
}

async function removeUserStorage(userId: string) {
  const client = getAdminClient();
  const bucket = client.storage.from('files');

  try {
    const { data: entryFolders, error: listError } = await bucket.list(userId, {
      limit: 1000,
    });

    if (listError) {
      // If the folder does not exist, list returns an error; treat as no-op.
      if ((listError as { statusCode?: number }).statusCode === 404) {
        return;
      }
      throw listError;
    }

    if (!entryFolders || entryFolders.length === 0) {
      return;
    }

    for (const folder of entryFolders) {
      const folderName = folder.name?.trim();
      if (!folderName) continue;

      const prefix = `${userId}/${folderName}`;
      const { data: files, error: filesError } = await bucket.list(prefix, {
        limit: 1000,
      });

      if (filesError) {
        if ((filesError as { statusCode?: number }).statusCode === 404) {
          continue;
        }
        throw filesError;
      }

      const paths = (files ?? [])
        .map((file) => file.name?.trim())
        .filter((name): name is string => Boolean(name))
        .map((name) => `${prefix}/${name}`);

      if (paths.length > 0) {
        await bucket.remove(paths);
      }
    }
  } catch (error) {
    console.warn('Failed to cleanup storage for test user', { userId, error });
  }
}

export async function createTestUser(): Promise<TestUserContext> {
  const client = getAdminClient();

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `playwright-${suffix}@example.com`;
  const password = `TestPassword!${suffix}`;
  const householdName = `Playwright Household ${suffix}`;

  const { data: userData, error: userError } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (userError || !userData?.user) {
    throw userError ?? new Error('Failed to create test user');
  }

  const userId = userData.user.id;

  const { data: householdData, error: householdError } = await client
    .from('households')
    .insert({ name: householdName })
    .select('id, name')
    .single();

  if (householdError || !householdData) {
    await client.auth.admin.deleteUser(userId);
    throw householdError ?? new Error('Failed to create test household');
  }

  const householdId = householdData.id as string;

  const { error: membershipError } = await client.from('household_members').insert({
    household_id: householdId,
    user_id: userId,
    role: 'owner',
  });

  if (membershipError) {
    await client.from('households').delete().eq('id', householdId);
    await client.auth.admin.deleteUser(userId);
    throw membershipError;
  }

  return {
    email,
    password,
    userId,
    householdId,
    householdName,
  };
}

export async function cleanupTestUser(context: TestUserContext) {
  const client = getAdminClient();

  await removeUserStorage(context.userId);
  await client.from('households').delete().eq('id', context.householdId);
  await client.auth.admin.deleteUser(context.userId);
}

export async function createHouseholdMember(
  household: TestUserContext,
  options?: { role?: string }
): Promise<HouseholdMemberContext> {
  const client = getAdminClient();

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `playwright-member-${suffix}@example.com`;
  const password = `TestPassword!${suffix}`;

  const { data: userData, error: userError } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (userError || !userData?.user) {
    throw userError ?? new Error('Failed to create household member');
  }

  const userId = userData.user.id;

  const { error: membershipError } = await client.from('household_members').insert({
    household_id: household.householdId,
    user_id: userId,
    role: options?.role ?? 'member',
  });

  if (membershipError) {
    await client.auth.admin.deleteUser(userId);
    throw membershipError;
  }

  return {
    email,
    password,
    userId,
    householdId: household.householdId,
    householdName: household.householdName,
  };
}

export async function cleanupHouseholdMember(member: HouseholdMemberContext) {
  const client = getAdminClient();

  await removeUserStorage(member.userId);
  await client.from('household_members').delete({ count: 'exact' }).eq('household_id', member.householdId).eq('user_id', member.userId);
  await client.auth.admin.deleteUser(member.userId);
}

export async function createZone(
  context: TestUserContext,
  options?: { name?: string; parentId?: string | null; surface?: number | null; note?: string | null }
): Promise<TestZone> {
  const client = getAdminClient();
  const name = options?.name ?? `Playwright Zone ${Date.now().toString(36)}`;
  const parentId = options?.parentId ?? null;

  const { data, error } = await client
    .from('zones')
    .insert({
      household_id: context.householdId,
      name,
      parent_id: parentId,
      created_by: context.userId,
      surface: options?.surface ?? null,
      note: options?.note ?? null,
    })
    .select('id, name')
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to create zone for test');
  }

  return {
    id: data.id as string,
    name: data.name as string,
  };
}

export async function createEntry(
  context: TestUserContext,
  params: { rawText: string; zoneIds: string[] }
): Promise<{ id: string }> {
  const client = getAdminClient();

  if (!params.zoneIds.length) {
    throw new Error('At least one zone id is required to create an entry');
  }

  const { data: entryData, error: entryError } = await client
    .from('entries')
    .insert({
      household_id: context.householdId,
      raw_text: params.rawText,
      created_by: context.userId,
    })
    .select('id')
    .single();

  if (entryError || !entryData) {
    throw entryError ?? new Error('Failed to create entry for test');
  }

  const entryId = entryData.id as string;

  const { error: linkError } = await client.from('entry_zones').insert(
    params.zoneIds.map((zoneId) => ({ entry_id: entryId, zone_id: zoneId }))
  );

  if (linkError) {
    await client.from('entries').delete().eq('id', entryId);
    throw linkError;
  }

  return { id: entryId };
}

export async function getEntryById(entryId: string): Promise<EntryRecord | null> {
  const client = getAdminClient();

  const { data, error } = await client
    .from('entries')
    .select('id')
    .eq('id', entryId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return (data as EntryRecord | null) ?? null;
}

export async function countEntryFiles(entryId: string): Promise<number> {
  const client = getAdminClient();

  const { data, error } = await client
    .from('entry_files')
    .select('id')
    .eq('entry_id', entryId);

  if (error) {
    throw error;
  }

  return (data?.length ?? 0);
}
