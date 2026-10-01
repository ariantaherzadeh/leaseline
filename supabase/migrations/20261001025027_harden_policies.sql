-- Advisor fixes after init_schema.

-- 1. Supabase's "automatic RLS" helper is an event-trigger function in public; nobody should
--    call it through the Data API. The event trigger keeps working without these grants.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- 2. One SELECT policy per role on listings (multiple permissive policies are evaluated
--    separately for every row).
drop policy "Published listings are public" on public.listings;
drop policy "Members see all their listings" on public.listings;

create policy "Anyone sees published listings" on public.listings
  for select to anon using (status = 'published');
create policy "Signed-in users see published listings and their own" on public.listings
  for select to authenticated
  using (status = 'published' or (select private.is_member(tenant_id)));
