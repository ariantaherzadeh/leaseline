# LeaseLine v2: leads, admin, and follow-ups

> Extends [DESIGN.md](DESIGN.md). Goal: close the product loop so LeaseLine runs in production
> for non-technical users. Renters talk to Nora → the leasing team gets the lead → the team
> manages listings themselves.

## Phases

| Phase | Outcome | Status |
|---|---|---|
| 0 | Monorepo: `apps/site`, `apps/dashboard`, `packages/shared`, `supabase/` | Done |
| 1 | Leads reach the realtor: post-call webhook → Supabase → email; leads inbox | Done (needs setup tokens) |
| 2 | Non-developers manage listings in the dashboard; site + Nora read from Supabase | Done |
| 3 | Phone line + consented follow-up calls (Twilio) | Later |

## Architecture

```
 renter ── tryleaseline.com (apps/site) ── ElevenLabs agent (Nora)
                  │ reads published listings          │ post-call webhook (HMAC)
                  ▼                                   ▼
            Supabase (ca-central-1) ◀── Edge Function: ingest-lead ──▶ email (Resend)
            listings · leads · team_members · listing_events
                  ▲                                   │ on listing change (pg_net)
                  │ authenticated (RLS)               ▼
 team ── app.tryleaseline.com (apps/dashboard)   GitHub Actions: leaseline deploy (Python)
                                                     → ElevenLabs knowledge base
```

### Sources of truth
| Data | Lives in | Edited by |
|---|---|---|
| Listings | Supabase `listings` | Leasing team, in the dashboard |
| Leads | Supabase `leads` | Written by the post-call webhook |
| Agent prompt, voice, guardrails, config | Git (`agent/`, `tenants/*/tenant.yaml`) | Developers, via PR |

### Database (Supabase, Postgres 17)
- `tenants`: one row per customer (`slug`, display name).
- `team_members(user_id, tenant_id, role)`: authorization. Login (`auth.users`) proves who you
  are; this table decides which tenant's data you can see and whether you can edit.
- `listings`: the fields from the listing schema; an unconfirmed fact is `null` (the dashboard
  shows a "Not confirmed yet" checkbox) rather than the string `TBD`; `status` (`draft` ·
  `published` · `archived`).
- `listing_events`: who changed what, when (edit history).
- `leads`: conversation id, tenant, contact fields, recommended listing, summary, evaluation
  results, call duration, `status` (new · contacted · closed).

**Security**
- RLS on every table. Public (`anon`) can read **published** listings only. Everything else
  requires an authenticated user who is a `team_member` of the row's tenant; editors can write.
- Public sign-up is disabled. Users join by invitation (magic link).
- Secrets live in Supabase (Edge Function secrets and Vault), never in the browser. The site
  and dashboard only use the publishable key.

**Working with the database**
- Migrations: `supabase/migrations/` (applied to the project, named by version).
- Seed: `supabase/seed.sql`, generated from the original listing files by
  `scripts/listings_to_sql.py`.
- RLS checks: `supabase/tests/rls_test.sql` runs in a rolled-back transaction; every row must
  pass. Run it after any policy change.
- Types: `packages/shared/src/database.types.ts`, generated from the live schema.

### Leads (phase 1)
1. ElevenLabs post-call webhook → Supabase Edge Function **`ingest-lead`**
   (`supabase/functions/ingest-lead`, `verify_jwt = false`).
2. It verifies the HMAC header (`elevenlabs-signature: t=<unix>,v0=<hex>`, HMAC-SHA256 of
   `"<unix>.<body>"`, 30-minute window, constant-time compare), maps the agent to a tenant via
   `tenants.agent_id`, and upserts the lead on `conversation_id` (retries are idempotent).
3. On the first delivery, if `RESEND_API_KEY` is set, it emails the tenant's `notify_email`
   (or every team member): name, contact, showing time, recommendation, summary.
4. The dashboard's inbox lists leads, newest first; each lead has its details, summary, the
   three call-quality checks, and a status (new / contacted / closed) plus notes for follow-up.

### Dashboard (`apps/dashboard`, app.tryleaseline.com)
- Next.js 16 + `@supabase/ssr`. `src/proxy.ts` refreshes the session on every request and
  sends signed-out visitors to `/login`.
- Login: email magic link (`signInWithOtp`, `shouldCreateUser: false`) → `/auth/callback`
  exchanges the PKCE code for a session cookie. Same response whether or not the email is on a
  team, so the form can't be used to discover members.
- Every query runs as the signed-in user with the publishable key; RLS decides access.
- Admin tasks run from the CLI with a project-scoped `SUPABASE_ACCESS_TOKEN`:
  `leaseline configure-auth` (sign-up off, redirect allow-list) and
  `leaseline add-member <email> --role admin|editor|viewer`.

**Setup:** `uv run leaseline setup-webhook` creates the ElevenLabs webhook, moves its one-time
secret straight into Supabase's function secrets (Management API; never printed), attaches it as
the workspace's post-call webhook, and self-tests the signature path with a signed request.
Needs `SUPABASE_ACCESS_TOKEN` (scoped to this project) in `.env`.

### Listings (phase 2)
- Dashboard: list, add, edit, archive, delete (with confirm), and per-listing edit history.
  Validation (`packages/shared/src/listing.ts`, zod) mirrors the table and the Python schema:
  a blank optional fact is saved as `NULL` ("not confirmed yet"); availability is now / a date /
  not confirmed; the URL name is generated from the title. Drafts stay private to the team.
- **Paste-to-fill:** on *Add listing*, paste MLS text, an email or notes → Edge Function
  `extract-listing` (signed-in editors only) asks Claude Opus 5.5 for structured output (zod
  schema, every fact nullable, "never infer" system prompt, low effort, server-side refusal
  fallback) → the form is pre-filled for review. Nothing is saved until the editor saves. Needs
  `ANTHROPIC_API_KEY` as a Supabase function secret; without it the box says it isn't set up.
- **Nora:** the Python sync (`leaseline deploy`) reads published listings from Supabase
  (`src/leaseline/supabase_source.py`, publishable key, NULL → "not confirmed") and keeps the
  same stateless, hash-named KB docs, safe order and mass-delete guard. `deploy.yml` runs it on
  every merge and **every 10 minutes**, so dashboard edits reach Nora within ~10 minutes (a
  no-op run when nothing changed; it also keeps the free Supabase project awake). An instant
  trigger on save (database → `workflow_dispatch`) can be added with a scoped GitHub token.
- **The prompt no longer lists homes**, and `show_listing` has no id enum: homes come only from
  the knowledge base (each starts with its Listing ID), so listing changes never touch the
  prompt or tools.
- **Public site:** reads published listings from Supabase at render time with ISR
  (`revalidate = 60`), formatted by `packages/shared/src/card.ts` (ported from the old Python
  export, same output, tested). Dashboard edits are live on the site within a minute.
- The original listing files now live in `tests/fixtures/` (offline tests use `--source files`).

### Follow-up calls (phase 3, later)
Consent captured on the call → SMS-verified number → scheduled outbound call via Twilio with
the first call's context → outcome updates the lead. Respects CRTC/CASL rules (consent,
identification as an AI, calling hours, opt-out).

## Hosting
| Piece | Where | Cost |
|---|---|---|
| Public site | Netlify `leaseline` → tryleaseline.com | Free |
| Dashboard | Netlify (second site, base `apps/dashboard`) → app.tryleaseline.com | Free |
| Database, auth, functions | Supabase `LeaseLine` (ca-central-1) | Free (weekly keep-alive) |
| Agent sync | GitHub Actions | Free |
| Email | Resend | Free tier |
