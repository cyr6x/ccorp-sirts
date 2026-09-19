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

- Nine local automated tests pass, including the full migration chain in PGlite, five-role lookup, anonymous denial, cross-user row isolation, profile self-promotion denial, direct assignment and workflow restrictions, forged audit denial, KB/assets write restrictions, live asset linking, KB source traceability, comment auditing, and SLA deadlines.
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
- Performance advisor reports only unused-index informational notices, expected before production traffic. Its missing foreign-key index finding was corrected.
- The live schema now includes incident/asset relationships, one-to-one incident/knowledge-article traceability, comment audit triggers, truthful incident action labels, and high/critical SLA notification triggers.

## Vercel status and remaining gate

The latest recovery-branch deployment is READY at:

`https://ccorp-sirts-git-rebuild-morning-sirts-cs-projects-020d9389.vercel.app`

The three backend variables below are configured in Vercel Preview, scoped to Git branch `rebuild/morning-sirts`:

```env
VITE_SUPABASE_URL=https://cudagansojpjtligqewe.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<fresh project's sb_publishable key>
VITE_SUPABASE_PROJECT_REF=cudagansojpjtligqewe
```

Commit `5686cc6db580334957698afbf138cd68353c22eb` deployed successfully from GitHub. Vercel reports the deployment READY with no runtime errors.

Browser UAT remains incomplete because Vercel Deployment Protection requires a temporary access link and browser authorization was not granted. Complete refresh/deep-link, desktop/mobile, session persistence, forms, role navigation, full CRUD, reports, empty/error-state, and large-list pagination checks before merge.

Hosted Auth has two explicit production blockers. Leaked-password protection is available only on Supabase Pro and cannot be enabled on the current Free organisation. Disabling public sign-ups was attempted in the dashboard, but Supabase rejected the save with `failed to update Auth config`. Locked profiles still prevent public sign-ups from obtaining an application role, but both hosted controls must be resolved before production.

Do not merge, tag stable, promote to production, or claim the restoration complete until browser UAT and the two hosted Auth blockers pass.
