import type { NextRequest } from "next/server";

import { redirectTo } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

// The magic link lands here with a one-time `code` (PKCE). Exchange it for a session cookie.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectTo("/");
  }
  return redirectTo("/login?error=link");
}
