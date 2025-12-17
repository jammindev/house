import { NextResponse } from "next/server";

import { createSSRClient } from "@/lib/supabase/server";
import { createServerAdminClient } from "@/lib/supabase/serverAdminClient";

const AVATAR_SIGNED_URL_TTL_SECONDS = 60 * 60 * 6; // 6 hours

type RouteContext = {
    params: {
        id: string;
    };
};

export async function GET(_request: Request, { params }: RouteContext) {
    try {
        const supabase = await createSSRClient();
        const {
            data: { user },
            error: sessionError,
        } = await supabase.auth.getUser();
        if (sessionError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Await params to get the actual id value
        const { id } = await params;

        if (!id || id === 'undefined') {
            return NextResponse.json({ error: "Invalid equipment ID" }, { status: 400 });
        }

        const { data: equipment, error: equipmentError } = await supabase
            .from("equipment")
            .select("id, household_id, created_at, created_by, updated_at, updated_by")
            .eq("id", id)
            .single();

        if (equipmentError) {
            if ("code" in equipmentError && equipmentError.code === "PGRST116") {
                return NextResponse.json({ error: "Not found" }, { status: 404 });
            }
            console.error("Failed to load equipment audit metadata:", equipmentError);
            return NextResponse.json({ error: "Unable to load audit metadata" }, { status: 400 });
        }

        if (!equipment) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const uniqueUserIds = Array.from(
            new Set(
                [equipment.created_by, equipment.updated_by].filter(
                    (identifier): identifier is string => Boolean(identifier),
                ),
            ),
        );

        const auditUsers = new Map<
            string,
            { email: string | null; username: string | null; avatar_url: string | null } | null
        >();
        if (uniqueUserIds.length > 0) {
            const adminClient = await createServerAdminClient();

            await Promise.all(
                uniqueUserIds.map(async (identifier) => {
                    try {
                        const { data, error } = await adminClient.auth.admin.getUserById(identifier);
                        if (error) {
                            console.error("Failed to load user for audit metadata:", error);
                            auditUsers.set(identifier, null);
                            return;
                        }

                        const user = data?.user;
                        // Prefer an explicit username/display name in user_metadata when available,
                        // fall back to email otherwise.
                        const username =
                            (user as any)?.user_metadata?.username ?? (user as any)?.user_metadata?.display_name ?? null;
                        const email = user?.email ?? null;
                        const avatarPath = (user as any)?.user_metadata?.avatar_path ?? null;

                        // Generate signed URL for avatar if path exists
                        let avatarUrl: string | null = null;
                        if (avatarPath) {
                            try {
                                const { data: signedData, error: signedError } = await supabase.storage
                                    .from('avatars')
                                    .createSignedUrl(avatarPath, AVATAR_SIGNED_URL_TTL_SECONDS);
                                if (!signedError && signedData?.signedUrl) {
                                    avatarUrl = signedData.signedUrl;
                                }
                            } catch (err) {
                                console.warn("Failed to generate avatar signed URL:", err);
                            }
                        }

                        auditUsers.set(identifier, { email, username, avatar_url: avatarUrl });
                    } catch (error) {
                        console.error("Unexpected error while loading audit user:", error);
                        auditUsers.set(identifier, null);
                    }
                }),
            );
        }

        return NextResponse.json({
            created_at: equipment.created_at,
            updated_at: equipment.updated_at,
            created_by: equipment.created_by
                ? {
                    id: equipment.created_by,
                    email: auditUsers.get(equipment.created_by)?.email ?? null,
                    username: auditUsers.get(equipment.created_by)?.username ?? null,
                    avatar_url: auditUsers.get(equipment.created_by)?.avatar_url ?? null,
                }
                : null,
            updated_by: equipment.updated_by
                ? {
                    id: equipment.updated_by,
                    email: auditUsers.get(equipment.updated_by)?.email ?? null,
                    username: auditUsers.get(equipment.updated_by)?.username ?? null,
                    avatar_url: auditUsers.get(equipment.updated_by)?.avatar_url ?? null,
                }
                : null,
        });
    } catch (error) {
        console.error("Unexpected error while handling equipment audit request:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}