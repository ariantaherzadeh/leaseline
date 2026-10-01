import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type Team = {
  userId: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  canEdit: boolean;
  tenant: { id: string; slug: string; name: string };
};

/** The signed-in user's team membership (first tenant), or null if they have none. */
export const getTeam = cache(async (): Promise<Team | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const claims = auth?.claims;
  if (!claims?.sub) return null;

  const { data } = await supabase
    .from("team_members")
    .select("role, tenants (id, slug, name)")
    .eq("user_id", claims.sub)
    .limit(1)
    .maybeSingle();
  if (!data?.tenants) return null;

  return {
    userId: claims.sub,
    email: String(claims.email ?? ""),
    role: data.role,
    canEdit: data.role === "admin" || data.role === "editor",
    tenant: data.tenants,
  };
});
