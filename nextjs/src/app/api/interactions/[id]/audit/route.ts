import { NextResponse } from "next/server";

import { createSSRClient } from "@/lib/supabase/server";
import { createServerAdminClient } from "@/lib/supabase/serverAdminClient";

type RouteContext = {
  params:
    | {
        id: string;
      }
    | Promise<{
        id: string;
      }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!id || id === "undefined") {
      return NextResponse.json({ error: "Invalid interaction ID" }, { status: 400 });
    }

    const supabase = await createSSRClient();
    const {
      data: { user },
      error: sessionError,
    } = await supabase.auth.getUser();
    if (sessionError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: interaction, error: interactionError } = await supabase
      .from("interactions")
      .select("id, household_id, created_at, created_by, updated_at, updated_by")
      .eq("id", id)
      .single();

    if (interactionError) {
      if ("code" in interactionError && interactionError.code === "PGRST116") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      console.error("Failed to load interaction audit metadata:", interactionError);
      return NextResponse.json({ error: "Unable to load audit metadata" }, { status: 400 });
    }

    if (!interaction) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const uniqueUserIds = Array.from(
      new Set(
        [interaction.created_by, interaction.updated_by].filter(
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
                  .createSignedUrl(avatarPath, 60 * 60 * 6); // 6 hours
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
      created_at: interaction.created_at,
      updated_at: interaction.updated_at,
      created_by: interaction.created_by
        ? {
          id: interaction.created_by,
          email: auditUsers.get(interaction.created_by)?.email ?? null,
          username: auditUsers.get(interaction.created_by)?.username ?? null,
          avatar_url: auditUsers.get(interaction.created_by)?.avatar_url ?? null,
        }
        : null,
      updated_by: interaction.updated_by
        ? {
          id: interaction.updated_by,
          email: auditUsers.get(interaction.updated_by)?.email ?? null,
          username: auditUsers.get(interaction.updated_by)?.username ?? null,
          avatar_url: auditUsers.get(interaction.updated_by)?.avatar_url ?? null,
        }
        : null,
    });
  } catch (error) {
    console.error("Unexpected error while handling interaction audit request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
