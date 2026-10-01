-- Map ElevenLabs agents to tenants (the post-call webhook only knows the agent id), and give
-- each tenant an address for new-lead emails.
alter table public.tenants
  add column agent_id text unique,
  add column notify_email text check (notify_email is null or notify_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

comment on column public.tenants.agent_id is 'ElevenLabs agent id serving this tenant (tenant.yaml agent_id).';
comment on column public.tenants.notify_email is 'Where new-lead emails go. Private: not readable by the public.';

-- Tenant rows stay publicly readable for slug/name, but the notification address must not be.
revoke select on public.tenants from anon, authenticated;
grant select (id, slug, name, agent_id, created_at) on public.tenants to anon, authenticated;

update public.tenants set agent_id = 'agent_2801m3svx7v2fz8sc70agxh2ts8q' where slug = 'demo';
