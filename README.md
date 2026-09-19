# CCorp SIRTS — morning recovery

Recovery branch: `rebuild/morning-sirts`.
Reference snapshot: `7a8f7ccae4e21ec32937d56d734424ae2daf7a3f`.
Original main: `09c4c7f51f308226258d1b716c40758750fb927e`, preserved by `backup/main-pre-morning-rebuild`.

This branch restores the morning React/Supabase modules and red/black neural visual system. No later hardening commits were merged or cherry-picked. Recovery-specific fixes are applied on top of that exact snapshot.

**Not ready for production:** new Supabase project creation is blocked by the account's two-active-free-project quota. No fresh backend, staff accounts, remote migration, Edge Function deployment, or successful Vercel recovery preview exists yet. The existing projects and production environment have not been modified.

## Local verification

From `client`, run `npm ci`, `npm test`, then `npm run build`.

`npm test` executes the consolidated SQL against an embedded PostgreSQL (PGlite) fixture and exercises role policies through SQL. This is useful local verification, not a substitute for live Supabase Auth, REST, Realtime, Edge Functions, or browser UAT.

`npm run dev` without backend variables shows a deliberate setup-pending screen. It makes no backend connection. Configure the variables in `client/.env.example` to use the fresh project. Unconfigured hosted previews show the same safe setup-pending screen; partially configured, mismatched, previous-project, or secret-key builds fail closed.

## Fresh backend setup after quota is resolved

1. Create `CCORP_SIRTS_REBUILD` in `Cyril556's Org` (`fxwbavdsmcwjhnzgyytl`), region `eu-central-2`. Do not restore a backup or copy data from any existing project.
2. Record its project reference, URL and publishable key. Apply the single SQL file in `supabase/migrations` to this empty project. The old experimental migration chain was removed; it remains in Git history.
3. Disable public sign-ups in the hosted Auth settings. The local `config.toml` does not automatically update hosted Auth settings. The profile trigger additionally requires trusted staff app metadata, so public signup cannot grant staff access even if accidentally enabled.
4. Provision accounts through Auth Admin using `client/scripts/provision-staff.mjs`, described below. Never insert password hashes or change PostgreSQL roles for staff authentication.
5. Deploy `supabase/functions/admin-create-user/index.ts` to the **new** project. Set function secret `SIRTS_PROJECT_REF` to the new reference. Gateway `verify_jwt` is false because the function verifies the actual bearer token via Auth, then checks the caller's current database role itself. No unauthenticated or non-admin call may provision accounts. The service/secret key stays inside the function.
6. Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SUPABASE_PROJECT_REF` to Vercel **Preview scoped specifically to `rebuild/morning-sirts`**. Use these values locally for development. Leave shared preview defaults, other branches and production unchanged.
7. Trigger a new preview, run the live gate in `docs/RECOVERY_STATUS.md`, and only merge after it passes.

## First administrator and staff provisioning

Use a private JSON array outside the repository (or an ignored `*.private.json` file). Each element must contain `first_name`, `last_name`, `email`, `role_id`, and `password` (at least 12 characters). Use the real approved staff roster, including an ADMIN. There are no embedded passwords, canned accounts or imported UUIDs.

Supply the three `VITE_SUPABASE_*` values above, `SUPABASE_SECRET_KEY` (the fresh project's secret), and `SIRTS_STAFF_FILE` via a secure environment loader. Run from `client`:

```sh
node scripts/provision-staff.mjs
```

The script uses Auth Admin `createUser`, relies on the transactionally created profile, verifies a real password login and role, and signs out. On retries it does not overwrite existing accounts or reset passwords. It stops on a mismatch. Do not pass secrets as command-line arguments or commit the roster.

After the first administrator is provisioned, the Users page uses the authenticated admin Edge Function, so adding another user does not replace the administrator's session.

## Role policy in this recovery

| Role | Incident visibility | Workflow privileges | Other modules |
|---|---|---|---|
| ADMIN | All | Assign, triage, resolve, close, reopen; delete | Users, KB/assets management, reports, audit |
| SOC_LEAD | All | Assign, triage, resolve, close, reopen | KB/assets management, reports, audit |
| SOC_ANALYST_L1 | Created by or assigned to self | Create, comment, triage | Read KB/assets |
| SOC_ANALYST_L2 | Created by or assigned to self | L1 plus resolve | Read KB/assets |
| SOC_ANALYST_L3 | Created by or assigned to self | L2 plus close | Read KB/assets |

Valid status transitions: New → Assigned or In Progress; Assigned → In Progress; In Progress → Resolved; Resolved → Closed or In Progress; Closed → In Progress (management only). Setting Assigned requires an assignee. The UI and SQL use the same tier restrictions. This is the proposed recovery policy and still requires live acceptance testing.

Incident creation/update audit records and status/assignment/severity history are written atomically by database triggers. Browsers cannot forge those records. Operational tables start empty by design; no old or fabricated incidents/assets/knowledge articles are imported.

## Recovery fixes

- Removed old-project defaults and shared demo passwords; isolated session storage by project.
- Moved staff profile queries out of the Auth callback to avoid Auth lock contention; profile failures are visible instead of silently becoming a generic analyst role.
- Replaced browser sign-up with a server-authorized staff creation function.
- Added all five roles, RLS, explicit grants, foreign-key indexes, Auth/profile trigger and Realtime publication.
- Added responsive hamburger navigation, URL-backed incident quick search, and management assignment controls.
- Added tier-aware status transitions and server-owned resolution timestamps.
- Fixed optional empty asset IP values, false-success mutations, hidden dashboard errors, and charts incorrectly calculated from only eight recent rows. Dashboard charts cover the last seven days; API pagination limits remain a live UAT item for large datasets.

The legacy `server` directory is historical and is not used by this Vite/Supabase deployment.
