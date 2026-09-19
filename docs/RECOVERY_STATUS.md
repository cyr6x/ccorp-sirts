# Recovery status — 19 September 2026

## Baseline and isolation

- Main remains at `09c4c7f51f308226258d1b716c40758750fb927e`.
- Backup branch: `backup/main-pre-morning-rebuild`.
- Recovery parent: `7a8f7ccae4e21ec32937d56d734424ae2daf7a3f`, exactly 15 commits ahead of main.
- No later hardening commits were merged or cherry-picked.
- `CCORP_SIRTS_DEV` (`pvtissqcpskpxlduxuta`) was paused after explicit approval to free the project slot. Pausing is reversible, but applications pointing to it are unavailable while it remains paused.
- `CCORP_SIRTS` (`tvjyllnfuptdcbirjvev`) and the production Vercel environment were not modified.

## Fresh Supabase backend — COMPLETE

- New project: `CCORP_SIRTS_REBUILD` (`cudagansojpjtligqewe`).
- Organisation: `fxwbavdsmcwjhnzgyytl`; region: `eu-central-2`; quoted project cost: $0/month.
- URL: `https://cudagansojpjtligqewe.supabase.co`.
- The clean baseline and follow-up migrations in `supabase/migrations` are applied. No database rows, Auth UUIDs, passwords, or migrations were copied from either old project.
- `admin-create-user` is deployed and checks the caller's live Auth identity and ADMIN profile before using Auth Admin.
- The Auth profile trigger creates a locked profile with `role_id = NULL`; server-side provisioning assigns the approved role only after Auth creation succeeds.
- Permanent recovery accounts are Sarah Namusoke (ADMIN) and Cyril Okello (SOC_LEAD). Both passed real password login and profile/role verification.
- Three temporary analyst accounts used for UAT were deleted. Generated UAT incidents, comments, knowledge articles, assets, and related audit/history rows were removed.
- The temporary bootstrap function is closed and returns HTTP 410.

## Verification completed

- Eight local automated tests pass, including baseline SQL execution in PGlite, five-role lookup, anonymous denial, cross-user row isolation, profile self-promotion denial, direct assignment and workflow restrictions, forged audit denial, and KB/assets write restrictions.
- Production build passes without backend variables and renders the deliberate setup-pending state. This prevents Git pushes from causing failed Vercel builds while Preview variables are absent.
- Live Supabase API UAT passed for ADMIN, SOC_LEAD, SOC_ANALYST_L1, SOC_ANALYST_L2, and SOC_ANALYST_L3:
  - correct-password login, wrong-password rejection, identity/profile resolution, and logout;
  - incident creation and role-scoped visibility;
  - management assignment and analyst reassignment denial;
  - visible-incident comments and unrelated-incident denial;
  - L1 triage, L2 resolve, L3 close, and prohibited transition denial;
  - KB/assets management writes, analyst reads, and analyst write denial;
  - server-owned audit records, analyst audit invisibility, and forged-audit denial;
  - non-admin staff-provisioning denial;
  - authenticated Realtime incident delivery.
- Supabase security advisor reports no schema/RLS findings. Its one warning is that hosted Auth leaked-password protection is disabled.
- Performance advisor reports only unused-index informational notices, expected before production traffic.

## Vercel status and remaining gate

The latest recovery-branch deployment is READY at:

`https://ccorp-sirts-git-rebuild-morning-sirts-cs-projects-020d9389.vercel.app`

It intentionally shows setup-pending until these variables are added to Vercel Preview, scoped only to Git branch `rebuild/morning-sirts`:

```env
VITE_SUPABASE_URL=https://cudagansojpjtligqewe.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<new project's sb_publishable key>
VITE_SUPABASE_PROJECT_REF=cudagansojpjtligqewe
```

The connected Vercel capability available during this recovery can inspect and deploy but cannot mutate project environment variables. Add the variables in the Vercel project settings, then redeploy the recovery branch.

After that, complete browser UAT for refresh/deep links, desktop/mobile navigation, forms, session refresh persistence, admin-session preservation during user creation, full CRUD screens, reports, empty/error states, and large-list pagination. Browser automation in the current runner was unavailable, so no visual/browser pass is claimed.

Also enable hosted Auth leaked-password protection and disable public sign-ups in Supabase settings. Locked profiles already prevent public sign-ups from obtaining an application role, but both hosted safeguards should be enabled before production.

Do not merge, tag stable, promote to production, or claim the restoration complete until the branch-specific Vercel variables and browser gate pass.
