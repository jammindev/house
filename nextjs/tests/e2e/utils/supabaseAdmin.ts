import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type TestUserContext = {
  email: string;
  password: string;
  userId: string;
  householdId: string;
  householdName: string;
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

export async function createTestUser(): Promise<TestUserContext> {
  const client = getAdminClient();

  const suffix = Date.now().toString(36);
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

  await client.from('households').delete().eq('id', context.householdId);
  await client.auth.admin.deleteUser(context.userId);
}
