# CCorp SIRTS — morning recovery

Recovery branch: `rebuild/morning-sirts`.
Reference snapshot: `7a8f7ccae4e21ec32937d56d734424ae2daf7a3f`.
Original main: `09c4c7f51f308226258d1b716c40758750fb927e`, preserved by `backup/main-pre-morning-rebuild`.

This branch restores the morning React/Supabase modules and red/black neural visual system. No later hardening commits were merged or cherry-picked. Recovery-specific fixes are applied on top of that exact snapshot.

The isolated backend now exists as `CCORP_SIRTS_REBUILD` (`cudagansojpjtligqewe`) in the existing organisation. The clean schema, Auth/profile repair, role policies, Realtime publication, and `admin-create-user` Edge Function are deployed. Live API UAT passed for all five roles, and the branch-specific Vercel preview is configured and READY. The recovery branch is still **not ready to merge or promote** until browser UAT and hosted Auth hardening pass.

## Local verification

From `client`, run `npm ci`, `npm test`, then `npm run build`.

`npm test` executes the consolidated SQL against an embedded PostgreSQL (PGlite) fixture and exercises role policies through SQL. This is useful local verification, not a substitute for live Supabase Auth, REST, Realtime, Edge Functions, or browser UAT.

`npm run dev` without backend variables shows a deliberate setup-pending screen. It makes no backend connection. Configure the variables in `client/.env.example` to use the fresh project. Unconfigured hosted previews show the same safe setup-pending screen; partially configured, mismatched, previous-project, or secret-key builds fail closed.

## Fresh backend and Vercel activation

1. The project was created fresh in `Cyril556's Org` (`fxwbavdsmcwjhnzgyytl`), region `eu-central-2`. No existing SIRTS data was restored or copied.
2. The migrations in `supabase/migrations` are applied to the new project. The old experimental migration chain remains only in Git history.
3. New Auth users begin with a locked profile (`role_id = NULL`). Only server-side Admin provisioning can activate a staff role, so public sign-up cannot grant application access. Public sign-ups should still be disabled in hosted Auth settings; local `config.toml` does not update that hosted setting.
4. Sarah Namusoke (ADMIN) and Cyril Okello (SOC_LEAD) were created through Auth Admin and verified by real password login. Never insert password hashes or change PostgreSQL roles for staff authentication.
5. `supabase/functions/admin-create-user/index.ts` is deployed to the **new** project. Gateway `verify_jwt` is false because the function verifies the bearer token via Auth, then checks the caller's current database role itself. The function also rejects all known previous project references. No unauthenticated or non-admin call may provision accounts. The service/secret key stays inside the function.
6. The values below are configured in Vercel **Preview scoped specifically to `rebuild/morning-sirts`**. Shared preview defaults, other branches and production remain unchanged.

```env
VITE_SUPABASE_URL=https://cudagansojpjtligqewe.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<new project's sb_publishable key>
VITE_SUPABASE_PROJECT_REF=cudagansojpjtligqewe
```

7. The branch deployment is READY. Complete the remaining browser checks and hosted Auth blockers in `docs/RECOVERY_STATUS.md`. Only merge after they pass.

## First administrator and staff provisioning

Use a private JSON array outside the repository (or an ignored `*.private.json` file). Each element must contain `first_name`, `last_name`, `email`, `role_id`, and `password` (at least 12 characters). Use the real approved staff roster, including an ADMIN. There are no embedded passwords, canned accounts or imported UUIDs.

Supply the three `VITE_SUPABASE_*` values above, `SUPABASE_SECRET_KEY` (the fresh project's secret), and `SIRTS_STAFF_FILE` via a secure environment loader. Run from `client`:

```sh
node scripts/provision-staff.mjs
```

The script uses Auth Admin `createUser`; the database trigger creates a locked profile with no role, and the server-side provisioning process activates the intended role. It then verifies a real password login and role, and signs out. On retries it does not overwrite existing accounts or reset passwords. It stops on a mismatch. Do not pass secrets as command-line arguments or commit the roster.

After the first administrator is provisioned, the Users page uses the authenticated admin Edge Function, so adding another user does not replace the administrator's session.

## Fictional demonstration data

The rebuild includes a preview-only, idempotent seed for six fictional SOC users plus interconnected incidents, assignments, assets, comments, knowledge articles, SLA notifications and audit activity. Reports are populated indirectly from the incident history because SIRTS has no reports table. Business departments are represented through the existing asset owner and incident context fields; the user schema is not expanded.

The seed is locked to `CCORP_SIRTS_REBUILD` and refuses every other project. It does not target Sarah or Cyril, reset any password, update pre-existing operational rows or change RLS. It uses deterministic IDs, skips verified matching records on repeat runs and stops on a collision. Keep all required values in an ignored environment file or secure environment loader, then run from `client`:

```sh
npm run seed:demo
```

Required values are documented in `client/.env.example`. Copy them into an ignored `client/.env` file; `npm run seed:demo` loads that file explicitly. The command creates users through Auth Admin, verifies every non-demo profile stayed unchanged, and signs in as every fictional role to check incident visibility, knowledge/assets access and audit restrictions. Do not run this seed against production.

## Role policy in this recovery

| Role | Incident visibility | Workflow privileges | Other modules |
|---|---|---|---|
| ADMIN | All | Assign, triage, resolve, close, reopen; delete | Users, KB/assets management, reports, audit |
| SOC_LEAD | All | Assign, triage, resolve, close, reopen | KB/assets management, reports, audit |
| SOC_ANALYST_L1 | Created by or assigned to self | Create, comment, triage | Read KB/assets |
| SOC_ANALYST_L2 | Created by or assigned to self | L1 plus resolve | Read KB/assets |
| SOC_ANALYST_L3 | Created by or assigned to self | L2 plus close | Read KB/assets |

Valid status transitions: New → Assigned or In Progress; Assigned → In Progress; In Progress → Resolved; Resolved → Closed or In Progress; Closed → In Progress (management only). Setting Assigned requires an assignee. The UI and SQL use the same tier restrictions. This policy passed live direct-API acceptance testing across all five roles on the fresh project.

Incident creation/update audit records and status/assignment/severity history are written atomically by database triggers. Browsers cannot forge those records. Operational tables start empty by design; no old or fabricated incidents/assets/knowledge articles are imported.

## Recovery fixes

- Removed old-project defaults and shared demo passwords; isolated session storage by project.
- Moved staff profile queries out of the Auth callback to avoid Auth lock contention; profile failures are visible instead of silently becoming a generic analyst role.
- Replaced browser sign-up with a server-authorized staff creation function.
- Added all five roles, RLS, explicit grants, foreign-key indexes, Auth/profile trigger and Realtime publication.
- Added responsive hamburger navigation, URL-backed incident quick search, and management assignment controls.
- Added tier-aware status transitions and server-owned resolution timestamps.
- Fixed optional empty asset IP values, false-success mutations, hidden dashboard errors, and charts incorrectly calculated from only eight recent rows. Dashboard charts cover the last seven days; large-list browser pagination remains a UAT item.
- Added relational incident assets, incident-to-knowledge-base capture, comment auditing, SLA deadline notifications, report filters/CSV export/monthly trends/analyst performance, audit filters, and user incident counts.
- Standardized displayed names to first name plus surname initial and constrained feature UI accents to the existing red/black/neutral theme.

The legacy `server` directory is historical and is not used by this Vite/Supabase deployment.
