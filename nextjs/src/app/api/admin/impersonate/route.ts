import { NextRequest, NextResponse } from "next/server";

import { createSSRClient } from "@/lib/supabase/server";
import { createServerAdminClient } from "@/lib/supabase/serverAdminClient";

const ADMIN_ROLES = new Set(["admin", "super_admin"]);

async function assertAdmin() {
    const supabase = await createSSRClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
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

    return { supabase, role: data.role as string, user };
}

export async function GET(request: NextRequest) {
    const adminCheck = await assertAdmin();
    if ("error" in adminCheck) return adminCheck.error;

    const search = request.nextUrl.searchParams.get("search")?.toLowerCase() ?? "";
    const pageParam = Number(request.nextUrl.searchParams.get("page") ?? "1");
    const perPageParam = Number(request.nextUrl.searchParams.get("perPage") ?? "50");
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const perPage = Number.isFinite(perPageParam) && perPageParam > 0 ? Math.min(perPageParam, 200) : 50;

    const adminClient = await createServerAdminClient();
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const users = (data?.users ?? []).map((user) => ({
        id: user.id,
        email: user.email ?? null,
        created_at: user.created_at ?? null,
        last_sign_in_at: user.last_sign_in_at ?? null,
        confirmed_at: (user as any).confirmed_at ?? null,
        display_name: (user as any)?.user_metadata?.display_name ?? null,
    }));

    const filtered = search
        ? users.filter((user) => {
            const haystack = `${user.email ?? ""} ${(user.display_name ?? "").toLowerCase()}`;
            return haystack.toLowerCase().includes(search);
        })
        : users;

    return NextResponse.json({
        users: filtered,
        pagination: {
            page: (data as any)?.page ?? page,
            perPage: (data as any)?.per_page ?? perPage,
            total: (data as any)?.total ?? filtered.length,
        },
    });
}

export async function POST(request: NextRequest) {
    const adminCheck = await assertAdmin();
    if ("error" in adminCheck) return adminCheck.error;

    const { userId } = await request.json();

    if (!userId || typeof userId !== "string") {
        return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const adminClient = await createServerAdminClient();

    const { data: targetUser, error: targetError } = await adminClient.auth.admin.getUserById(userId);
    if (targetError || !targetUser?.user) {
        return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const targetEmail = targetUser.user.email;
    if (!targetEmail) {
        return NextResponse.json({ error: "Le compte ne possède pas d'email" }, { status: 400 });
    }

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: "magiclink",
        email: targetEmail,
    });

    if (linkError) {
        return NextResponse.json({ error: linkError.message }, { status: 400 });
    }

    const tokenHash = linkData?.properties?.hashed_token;

    if (!tokenHash) {
        return NextResponse.json({ error: "Impossible de générer le lien d'impersonation" }, { status: 500 });
    }

    return NextResponse.json({
        tokenHash,
        email: targetEmail,
        userId,
    });
}
