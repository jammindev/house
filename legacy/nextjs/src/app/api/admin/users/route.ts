import { NextRequest, NextResponse } from "next/server";

import { createSSRClient } from "@/lib/supabase/server";
import { createServerAdminClient } from "@/lib/supabase/serverAdminClient";

const ADMIN_ROLES = new Set(["admin", "super_admin"]);

async function assertAdmin() {
    const supaSSR = await createSSRClient();
    const {
        data: { user },
        error: sessionError,
    } = await supaSSR.auth.getUser();

    if (sessionError || !user) {
        return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }

    const adminClient = await createServerAdminClient();
    const { data, error } = await adminClient
        .from("system_admins")
        .select("role")
        .eq("user_id", user.id)
        .single();

    if (error || !data || !ADMIN_ROLES.has(data.role as string)) {
        return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }

    return { adminClient };
}

export async function GET(request: NextRequest) {
    const result = await assertAdmin();
    if ("error" in result) return result.error;
    const { adminClient } = result;

    const search = request.nextUrl.searchParams.get("search")?.toLowerCase() ?? "";
    const pageParam = Number(request.nextUrl.searchParams.get("page") ?? "1");
    const perPageParam = Number(request.nextUrl.searchParams.get("perPage") ?? "100");
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const perPage = Number.isFinite(perPageParam) && perPageParam > 0 ? Math.min(perPageParam, 500) : 100;

    const [{ data: userPage, error: listError }, { data: adminRows }, { data: members }] = await Promise.all([
        adminClient.auth.admin.listUsers({ page, perPage }),
        adminClient.from("system_admins").select("user_id, role"),
        adminClient.from("household_members").select("user_id"),
    ]);

    if (listError) {
        return NextResponse.json({ error: listError.message }, { status: 400 });
    }

    const adminByUser = new Map<string, string>();
    (adminRows ?? []).forEach((row) => {
        if (row.user_id) adminByUser.set(row.user_id, row.role as string);
    });

    const householdCounts = new Map<string, number>();
    (members ?? []).forEach((row) => {
        if (!row.user_id) return;
        householdCounts.set(row.user_id, (householdCounts.get(row.user_id) ?? 0) + 1);
    });

    const users =
        (userPage?.users ?? []).map((user) => {
            const role = adminByUser.get(user.id);
            return {
                id: user.id,
                email: user.email ?? "",
                display_name: (user as any)?.user_metadata?.display_name ?? null,
                created_at: user.created_at ?? null,
                last_sign_in_at: user.last_sign_in_at ?? null,
                email_confirmed_at: (user as any)?.email_confirmed_at ?? null,
                households_count: householdCounts.get(user.id) ?? 0,
                interactions_count: 0,
                is_admin: Boolean(role),
                admin_role: role ?? null,
            };
        }) ?? [];

    const filtered = search
        ? users.filter((user) => {
            const haystack = `${user.email ?? ""} ${(user.display_name ?? "").toLowerCase()}`;
            return haystack.toLowerCase().includes(search);
        })
        : users;

    return NextResponse.json({
        users: filtered,
        pagination: {
            page: (userPage as any)?.page ?? page,
            perPage: (userPage as any)?.per_page ?? perPage,
            total: (userPage as any)?.total ?? filtered.length,
        },
    });
}
