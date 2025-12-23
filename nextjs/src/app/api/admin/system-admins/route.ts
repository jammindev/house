import { NextResponse } from "next/server";
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

    return { userRole: data.role as string, adminClient };
}

export async function GET() {
    const result = await assertAdmin();
    if ("error" in result) return result.error;

    const { adminClient } = result;

    const { data, error } = await adminClient
        .from("system_admins")
        .select("id, user_id, role, granted_by, granted_at, notes, created_at, updated_at")
        .order("created_at", { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const admins = (data ?? []).map((admin, index) => ({
        ...admin,
        role: admin.role as "admin" | "super_admin",
        granted_by: admin.granted_by || undefined,
        notes: admin.notes || undefined,
        created_at: admin.created_at || new Date().toISOString(),
        updated_at: admin.updated_at || new Date().toISOString(),
        user_email: admin.user_id ? `admin${index + 1}@example.com` : undefined,
        user_display_name: admin.user_id ? `Administrateur ${index + 1}` : undefined,
    }));

    return NextResponse.json({ admins });
}

