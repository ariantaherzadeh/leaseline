import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

// The magic link lands here with a one-time `code` (PKCE). Exchange it for a session cookie.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const home = new URL("/", request.url);
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(home);
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("error", "link");
  return NextResponse.redirect(login);
}
