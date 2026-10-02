# Supabase Deployment

## Apply the mirror schema

Install the Supabase CLI, link this repository to the target project, then apply checked-in migrations before go-live:

```powershell
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

The initial migration creates the cloud mirror, event ledger, read-only browser policies, and realtime publication entries. The following stock-movement migration is safe to run after it. Keep schema changes in `supabase/migrations/`; `schema.sql` is the rerunnable SQL Editor bootstrap for existing projects.

## Runtime credentials

Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the local hub/Electron process environment. The service-role key is required for outbox writes and must never be prefixed with `VITE_`, embedded in the renderer, or configured in Vercel. The browser receives only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; the schema grants those roles read access only.

Build the tablet client with `VITE_HUB_URL` set to the depot hub's reachable LAN address, for example `http://192.168.1.20:4821`. The tablet talks to SQLite through the hub over the local network; internet loss does not prevent local sales.

## Daily reconciliation on Windows

Run `npm run compare:databases` once daily from Task Scheduler. For a packaged installation, set `SML_SQLITE_DB` to the hub's active `pharmacy.db` path in the scheduled process environment. The command exits with code `1` when outbox events remain unsynced, cloud reads fail, or the compared records differ; direct its output to a log and configure Task Scheduler to alert on a nonzero result.
