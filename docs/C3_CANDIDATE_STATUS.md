# C3 candidate status — 2026-09-23 UTC

Base: C2 Git commit `abd5062d9de7633d517a6fcaa1c64a898e950ea5`.
Candidate branch: `codex/sirts-c3-preview`. Hosted Supabase project: `cudagansojpjtligqewe`.

## Changes and evidence

| Slice | Changed paths | Executed evidence | Residual risk |
|---|---|---|---|
| Reports and CSV | `client/src/pages/ReportsPage.jsx`, `client/src/lib/reportRequestState.js`, `client/tests/reports-hardening.test.mjs` | Out-of-order asynchronous responses publish only the current filter; CSV round-trips formula-like, quoted, comma, newline and null cells; `npm test` | No authenticated browser export or network-delay run yet. |
| Breach assessment | `supabase/migrations/20260923090000_breach_assessment_workflow.sql`, `client/src/pages/KdpaTrackerPage.jsx`, `client/src/pages/DashboardPage.jsx`, `client/tests/recovery.test.mjs` | Clean PGlite migrations, management allow / analyst and anonymous deny, awareness + 72-hour deadline, audit, sent state, non-required outcome, independent SLA; `npm test` | Hosted C2 schema lacks this table. Do not label the preview end-to-end ready until a separate branch database is available or migration approval is granted. No external notice is sent. Existing severity-based KDPA rows remain as legacy records, not deleted. |
| Reproducibility | `.github/workflows/client-checks.yml`, `README.md` | `npm ci`, `npm test`, `npm run build`, `git diff --check` locally | CI run not yet observed. |

## Current decision

**NOT READY for production promotion.** No hosted migration, Auth setting, production env var, live record, alias or deployment has been changed. The shared database's migration head remains `20260922233443_final_freeze_rpc_privileges`. Creating a Supabase dev branch currently lists an hourly cost, so it requires approval first. A Vercel preview branch using the shared hosted schema will display a controlled tracker error until the new table exists; do not send it as the lecturer link.

Remaining verification: real five-role browser UAT including login/logout/denial, Reports runtime CSV, narrow/tablet/desktop and keyboard checks, live read-only state reconciling dashboard counts, CI workflow success, clean Auth configuration review, and controlled performance runs. Human participant UAT remains NOT CONDUCTED. Do not call this legal compliance or full WCAG conformance.

The Production Vite build requires `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_REF` and `VITE_SUPABASE_PUBLISHABLE_KEY` scoped to Production, followed by redeploy and private-window verification. Do that only after the exact C3 revision, database migration and preview checks are approved. Never put a service-role/secret key in Vercel `VITE_*` variables.
