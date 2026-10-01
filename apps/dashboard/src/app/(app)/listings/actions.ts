"use server";

import { fieldErrors, listingFormSchema } from "@leaseline/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getTeam } from "@/lib/team";

export type ListingFormState = { errors: Record<string, string>; values?: Record<string, string> };

const LIST_FIELDS = ["utilities_included", "tenant_pays", "amenities", "highlights"] as const;

function formValues(form: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  }
  return values;
}

function friendly(message: string): string {
  if (message.includes("listings_tenant_id_slug_key")) return "Another listing already uses this URL name.";
  if (message.includes("row-level security")) return "You don't have permission to change listings.";
  return message;
}

export async function saveListing(
  _prev: ListingFormState,
  form: FormData,
): Promise<ListingFormState> {
  const team = await getTeam();
  if (!team?.canEdit) return { errors: { form: "You don't have permission to change listings." } };

  const values = formValues(form);
  const parsed = listingFormSchema.safeParse({
    ...values,
    ...Object.fromEntries(LIST_FIELDS.map((f) => [f, values[f] ?? ""])),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const id = values.id;
  const row = { ...parsed.data, tenant_id: team.tenant.id };
  const { data, error } = id
    ? await supabase.from("listings").update(row).eq("id", id).select("id").single()
    : await supabase.from("listings").insert(row).select("id").single();
  if (error) return { errors: { form: friendly(error.message) }, values };

  revalidatePath("/listings");
  redirect(`/listings?saved=${data.id}`);
}

export async function deleteListing(form: FormData): Promise<void> {
  const id = String(form.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.from("listings").delete().eq("id", id);
  if (error) throw new Error(friendly(error.message));
  revalidatePath("/listings");
  redirect("/listings?deleted=1");
}
