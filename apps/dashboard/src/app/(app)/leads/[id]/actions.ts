"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const update = z.object({
  id: z.uuid(),
  status: z.enum(["new", "contacted", "closed"]),
  notes: z.string().max(4000).transform((v) => v.trim() || null),
});

export async function updateLead(form: FormData): Promise<void> {
  const values = update.parse({
    id: form.get("id"),
    status: form.get("status"),
    notes: form.get("notes") ?? "",
  });
  const supabase = await createClient();
  // RLS + column grants: only editors of this lead's tenant can change status and notes.
  const { error } = await supabase
    .from("leads")
    .update({ status: values.status, notes: values.notes })
    .eq("id", values.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/leads/${values.id}`);
  revalidatePath("/");
}
