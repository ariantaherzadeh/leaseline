import { revalidatePath } from "next/cache";

import { redirectTo } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  return redirectTo("/login", 302);
}
