-- Row-level security checks. Runs inside a transaction and rolls back, so it's safe to run
-- against any project (including production) via the SQL editor or MCP execute_sql.
-- Every row in the final result must have passed = true.
begin;
create temp table results (check_name text, passed boolean, detail text) on commit drop;
grant all on results to anon, authenticated;

insert into public.tenants (slug, name) values ('rls-test-other', 'Other realtor');
insert into public.tenants (slug, name) values ('rls-test', 'RLS test realtor');
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000aaaa', 'member@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000bbbb', 'stranger@test.local', 'authenticated', 'authenticated');
insert into public.team_members (tenant_id, user_id, role)
  select id, '00000000-0000-0000-0000-00000000aaaa', 'editor' from public.tenants where slug = 'rls-test';
insert into public.team_members (tenant_id, user_id, role)
  select id, '00000000-0000-0000-0000-00000000bbbb', 'admin' from public.tenants where slug = 'rls-test-other';
insert into public.listings (tenant_id, slug, status, title, street, city, province, postal_code, neighbourhood, property_type, rent_monthly, beds, baths)
  select id, s, st::public.listing_status, 'Test home ' || s, '1 Test St', 'Ottawa', 'ON', 'K1A 0A1', 'Test', 'Apartment', 1000, 1, 1
  from public.tenants, (values ('pub-test', 'published'), ('draft-test', 'draft')) v(s, st)
  where slug = 'rls-test';
insert into public.leads (tenant_id, conversation_id, agent_id, renter_name, contact)
  select id, 'conv_rlstest000001', 'agent_x', 'Jane Test', '613-555-0100' from public.tenants where slug = 'rls-test';

set local role anon;
insert into results select 'anon sees published, not drafts', bool_and(status = 'published') and count(*) filter (where slug = 'draft-test') = 0, count(*)::text from public.listings;
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000aaaa","role":"authenticated"}';
insert into results select 'member sees their draft', count(*) = 1, count(*)::text from public.listings where slug = 'draft-test';
insert into results select 'member sees their lead', count(*) = 1, count(*)::text from public.leads where conversation_id = 'conv_rlstest000001';
update public.listings set rent_monthly = 1100 where slug = 'draft-test';
insert into results select 'member can edit their listing', rent_monthly = 1100, rent_monthly::text from public.listings where slug = 'draft-test';
update public.leads set status = 'contacted' where conversation_id = 'conv_rlstest000001';
insert into results select 'member can update lead status', status = 'contacted', status::text from public.leads where conversation_id = 'conv_rlstest000001';
insert into results select 'history recorded with actor', count(*) = 1, count(*)::text from public.listing_events where listing_slug = 'draft-test' and action = 'updated' and actor = '00000000-0000-0000-0000-00000000aaaa';
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000bbbb","role":"authenticated"}';
insert into results select 'stranger cannot see the draft', count(*) = 0, count(*)::text from public.listings where slug = 'draft-test';
insert into results select 'stranger cannot see the lead', count(*) = 0, count(*)::text from public.leads where conversation_id = 'conv_rlstest000001';
update public.listings set rent_monthly = 1 where slug = 'pub-test';
reset role;
insert into results select 'stranger could not edit', rent_monthly = 1000, rent_monthly::text from public.listings where slug = 'pub-test';

set local role anon;
insert into results select 'anon gets one call by id', public.call_result('conv_rlstest000001') is not null, coalesce(public.call_result('conv_rlstest000001') ->> 'renter_name', 'null');
insert into results select 'anon gets nothing for an unknown id', public.call_result('conv_nosuchcall0001') is null, coalesce(public.call_result('conv_nosuchcall0001')::text, 'null');
reset role;
insert into results select 'only anon can call call_result', not has_function_privilege('authenticated', 'public.call_result(text)', 'execute'), has_function_privilege('authenticated', 'public.call_result(text)', 'execute')::text;

select * from results order by passed, check_name;
rollback;

-- Also expected: `set role anon; select * from public.leads;` fails with
-- "permission denied for table leads" (no grant at all, not just RLS).
