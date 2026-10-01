"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string };

export async function sendMagicLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = z.string().trim().email().safeParse(form.get("email"));
  if (!email.success) return { status: "error", message: "Enter a valid email address." };

  const origin = (await headers()).get("origin") ?? "https://app.tryleaseline.com";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    // Invite-only: never create an account from the login form.
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback` },
  });
  // Same message whether or not the address has an account, so the form can't be used to
  // discover who's on the team.
  if (error && error.status !== 422 && error.code !== "otp_disabled") {
    return { status: "error", message: "We couldn't send the link. Try again in a minute." };
  }
  return { status: "sent", message: email.data };
}
