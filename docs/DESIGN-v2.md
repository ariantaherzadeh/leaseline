# LeaseLine v2: leads, admin, and follow-ups

> Extends [DESIGN.md](DESIGN.md). Goal: close the product loop so LeaseLine runs in production
> for non-technical users. Renters talk to Nora → the leasing team gets the lead → the team
> manages listings themselves.

## Phases

| Phase | Outcome | Status |
|---|---|---|
| 0 | Monorepo: `apps/site`, `apps/dashboard`, `packages/shared`, `supabase/` | Done |
| 1 | Leads reach the realtor: post-call webhook → Supabase → email; leads inbox | Planned |
| 2 | Non-developers manage listings in the dashboard; site + Nora read from Supabase | Planned |
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
1. ElevenLabs post-call webhook → Supabase Edge Function `ingest-lead`.
2. Verify the HMAC signature, then upsert the lead (idempotent on conversation id).
3. If `RESEND_API_KEY` is set, email the tenant's team: name, contact, home, showing time, summary.
4. The dashboard's inbox lists leads, newest first, with the transcript summary and checks.

### Listings (phase 2)
- Dashboard: list, add, edit, archive, delete (with confirm); validation mirrors the Python
  schema; "Not confirmed yet" checkboxes instead of `TBD`.
- **Paste-to-fill:** paste a listing description; an Edge Function asks Claude to extract the
  fields; the team reviews before saving.
- On change, a database trigger dispatches the **Python** sync workflow (`leaseline deploy`),
  which now reads listings from Supabase. Same stateless, hash-named KB docs, same safe order,
  same mass-delete guard.
- The public site reads published listings from Supabase (revalidated every minute).
- The agent prompt no longer lists listing ids; homes come only from the knowledge base, so
  listing changes never require a prompt change.

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
