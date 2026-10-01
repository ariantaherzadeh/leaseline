-- LeaseLine v2 schema: tenants, team membership, listings (+ history), and leads.
-- Access model (see docs/DESIGN-v2.md):
--   anon / renters    → read published listings (and tenant names) only
--   team members      → read their tenant's data; editors/admins write listings and leads
--   service_role      → Edge Functions (lead ingestion, invites)
-- "Automatically expose new tables" is off for this project, so every grant below is explicit.

-- ---------------------------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------------------------
create type public.team_role as enum ('admin', 'editor', 'viewer');
create type public.listing_status as enum ('draft', 'published', 'archived');
create type public.lead_status as enum ('new', 'contacted', 'closed');

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  created_at timestamptz not null default now()
);
comment on table public.tenants is 'A LeaseLine customer (realtor or property manager). Matches tenants/<slug>/ in the repo.';

create table public.team_members (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.team_role not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index team_members_user_id_idx on public.team_members (user_id);
comment on table public.team_members is 'Authorization: which tenant a logged-in user works for, and their role.';

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 64),
  status public.listing_status not null default 'draft',

  title text not null check (length(title) between 3 and 120),
  street text not null,
  unit text,
  city text not null,
  province text not null check (province ~ '^[A-Z]{2}$'),
  postal_code text not null,
  neighbourhood text not null,
  property_type text not null,

  rent_monthly integer not null check (rent_monthly > 0),
  beds smallint not null check (beds >= 0),
  baths numeric(3, 1) not null check (baths > 0),

  -- Unconfirmed facts are NULL. The agent renders NULL as "not confirmed, offer a follow-up";
  -- it never guesses.
  sqft text check (sqft ~ '^\d{3,5}(\s*[–-]\s*\d{3,5})?$'),
  available_now boolean not null default false,
  available_on date,
  pets text,
  laundry text,
  cooling text,
  heating text,
  parking_spots smallint check (parking_spots >= 0),
  parking_type text,

  utilities_included text[] not null default '{}',
  tenant_pays text[] not null default '{}',
  amenities text[] not null default '{}',
  highlights text[] not null default '{}',
  outdoor text,
  storage text,
  transit text,
  description text not null default '',
  mls_number text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,

  unique (tenant_id, slug),
  check (not (available_now and available_on is not null))
);
create index listings_tenant_status_idx on public.listings (tenant_id, status);
create index listings_created_by_idx on public.listings (created_by);
create index listings_updated_by_idx on public.listings (updated_by);
comment on table public.listings is 'Rental listings. Published rows are public and synced to the agent knowledge base.';

create table public.listing_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  listing_slug text not null,
  action text not null check (action in ('created', 'updated', 'deleted')),
  actor uuid references auth.users (id) on delete set null,
  changes jsonb,
  at timestamptz not null default now()
);
create index listing_events_tenant_at_idx on public.listing_events (tenant_id, at desc);
create index listing_events_listing_id_idx on public.listing_events (listing_id);
create index listing_events_actor_idx on public.listing_events (actor);
comment on table public.listing_events is 'Edit history for listings: who changed what, when.';

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  conversation_id text not null unique,
  agent_id text not null,
  status public.lead_status not null default 'new',

  renter_name text,
  contact text,
  preferred_showing_time text,
  recommended_listing_slug text,
  budget_monthly integer,
  bedrooms_needed integer,
  move_in text,
  pets text,
  vehicles integer,

  title text,
  summary text,
  call_successful text,
  evaluation jsonb not null default '{}',
  data_collection jsonb not null default '{}',
  duration_secs integer,
  started_at timestamptz,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_tenant_created_idx on public.leads (tenant_id, created_at desc);
comment on table public.leads is 'One row per renter conversation, written by the post-call webhook.';

-- ---------------------------------------------------------------------------------------------
-- RLS helpers (private schema: not exposed through the Data API)
-- ---------------------------------------------------------------------------------------------
create schema if not exists private;

create or replace function private.is_member(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where tenant_id = p_tenant and user_id = (select auth.uid())
  );
$$;

create or replace function private.can_edit(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where tenant_id = p_tenant
      and user_id = (select auth.uid())
      and role in ('admin', 'editor')
  );
$$;

revoke all on function private.is_member(uuid), private.can_edit(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_member(uuid), private.can_edit(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Triggers: updated_at / updated_by, and listing history
-- ---------------------------------------------------------------------------------------------
create or replace function private.touch_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_table_name = 'listings' then
    new.updated_by := (select auth.uid());
    if tg_op = 'INSERT' then
      new.created_by := (select auth.uid());
    end if;
  end if;
  return new;
end;
$$;

create trigger listings_touch before insert or update on public.listings
  for each row execute function private.touch_row();
create trigger leads_touch before update on public.leads
  for each row execute function private.touch_row();

-- Writes history rows on behalf of the editing user. SECURITY DEFINER so editors don't need
-- insert rights on listing_events; it records auth.uid() as the actor and nothing else.
create or replace function private.log_listing_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed jsonb;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, n.value) into changed
    from jsonb_each(to_jsonb(new)) n
    join jsonb_each(to_jsonb(old)) o using (key)
    where n.value is distinct from o.value
      and n.key not in ('updated_at', 'updated_by');
    if changed is null then
      return new;
    end if;
  end if;

  insert into public.listing_events (tenant_id, listing_id, listing_slug, action, actor, changes)
  values (
    coalesce(new.tenant_id, old.tenant_id),
    case when tg_op = 'DELETE' then null else new.id end,
    coalesce(new.slug, old.slug),
    case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
    (select auth.uid()),
    case when tg_op = 'UPDATE' then changed else null end
  );
  return coalesce(new, old);
end;
$$;
revoke all on function private.log_listing_event() from public, anon, authenticated;

create trigger listings_history after insert or update or delete on public.listings
  for each row execute function private.log_listing_event();

-- ---------------------------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------------------------
alter table public.tenants enable row level security;
alter table public.team_members enable row level security;
alter table public.listings enable row level security;
alter table public.listing_events enable row level security;
alter table public.leads enable row level security;

-- Tenant names/slugs are public (they appear on the site).
create policy "Tenants are public" on public.tenants
  for select to anon, authenticated using (true);

-- Members see their own memberships and their teammates'. Changes go through service_role.
create policy "Members see their team" on public.team_members
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_member(tenant_id)));

-- Listings: everyone sees published; members also see drafts/archived; editors write.
create policy "Published listings are public" on public.listings
  for select to anon, authenticated using (status = 'published');
create policy "Members see all their listings" on public.listings
  for select to authenticated using ((select private.is_member(tenant_id)));
create policy "Editors add listings" on public.listings
  for insert to authenticated with check ((select private.can_edit(tenant_id)));
create policy "Editors update listings" on public.listings
  for update to authenticated
  using ((select private.can_edit(tenant_id)))
  with check ((select private.can_edit(tenant_id)));
create policy "Editors delete listings" on public.listings
  for delete to authenticated using ((select private.can_edit(tenant_id)));

create policy "Members see listing history" on public.listing_events
  for select to authenticated using ((select private.is_member(tenant_id)));

-- Leads are private to the tenant's team. Inserts come only from the webhook (service_role).
create policy "Members see their leads" on public.leads
  for select to authenticated using ((select private.is_member(tenant_id)));
create policy "Editors update their leads" on public.leads
  for update to authenticated
  using ((select private.can_edit(tenant_id)))
  with check ((select private.can_edit(tenant_id)));

-- ---------------------------------------------------------------------------------------------
-- Grants (Data API exposure is opt-in on this project)
-- ---------------------------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant usage on type public.team_role, public.listing_status, public.lead_status
  to anon, authenticated, service_role;

grant select on public.tenants to anon, authenticated;
grant select on public.listings to anon, authenticated;
grant insert, update, delete on public.listings to authenticated;
grant select on public.team_members, public.listing_events, public.leads to authenticated;
grant update (status, notes) on public.leads to authenticated;

grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
