import { NextResponse } from "next/server";

import { createSSRClient } from "@/lib/supabase/server";
import { createServerAdminClient } from "@/lib/supabase/serverAdminClient";

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

    const { data: interaction, error: interactionError } = await supabase
      .from("interactions")
      .select("id, household_id, created_at, created_by, updated_at, updated_by")
      .eq("id", params.id)
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

    const auditUsers = new Map<string, string | null>();
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
            auditUsers.set(identifier, data?.user?.email ?? null);
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
            email: auditUsers.get(interaction.created_by) ?? null,
          }
        : null,
      updated_by: interaction.updated_by
        ? {
            id: interaction.updated_by,
            email: auditUsers.get(interaction.updated_by) ?? null,
          }
        : null,
    });
  } catch (error) {
    console.error("Unexpected error while handling interaction audit request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
