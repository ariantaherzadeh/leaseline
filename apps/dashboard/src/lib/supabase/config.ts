// Public Supabase settings. The publishable key is safe in the browser: row-level security
// (supabase/migrations) decides what each request can read or write.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://lyplhlbjuhsigkurckqx.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_GoSBclQLRWtKdjTJNfIXsw_wXTx1Fgx";
