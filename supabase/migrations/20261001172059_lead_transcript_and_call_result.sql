-- Store the call transcript with the lead, so the database has the whole call.
alter table public.leads add column transcript jsonb not null default '[]';
comment on column public.leads.transcript is
  'Agent and renter turns: [{role, message, at_secs}], from the post-call webhook.';

-- The public demo site's "what the leasing team receives" page shows the result of the call the
-- visitor just made. The conversation id (random, only known to the caller's browser) is the
-- capability, the same model as before when the site read the call from ElevenLabs. Returns only
-- what that page shows, for one call; never lists leads. Null until the post-call webhook lands.
-- SECURITY DEFINER is deliberate (anon has no access to leads); the advisor warning for it is
-- expected.
create or replace function public.call_result(p_conversation_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'title', l.title,
    'summary', l.summary,
    'call_successful', l.call_successful,
    'duration_secs', l.duration_secs,
    'started_at', l.started_at,
    'renter_name', l.renter_name,
    'contact', l.contact,
    'preferred_showing_time', l.preferred_showing_time,
    'budget_monthly', l.budget_monthly,
    'bedrooms_needed', l.bedrooms_needed,
    'move_in', l.move_in,
    'vehicles', l.vehicles,
    'pets', l.pets,
    'recommended_listing_slug', l.recommended_listing_slug,
    'evaluation', l.evaluation,
    'transcript', l.transcript
  )
  from public.leads l
  where p_conversation_id ~ '^conv_[a-z0-9]{10,64}$'
    and l.conversation_id = p_conversation_id
$$;
comment on function public.call_result(text) is
  'One call''s result by conversation id, for the public demo page. Never lists leads.';

-- Only the public site (publishable key = anon) calls it; signed-in team members read leads directly.
revoke execute on function public.call_result(text) from public, authenticated;
grant execute on function public.call_result(text) to anon;
