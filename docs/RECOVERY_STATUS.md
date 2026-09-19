# Recovery status — 19 September 2026

## Baseline and isolation

- Main verified at `09c4c7f51f308226258d1b716c40758750fb927e`.
- Backup branch: `backup/main-pre-morning-rebuild`.
- Recovery parent: `7a8f7ccae4e21ec32937d56d734424ae2daf7a3f`, exactly 15 commits ahead of main.
- No later hardening commits included.
- New backend proposed: `CCORP_SIRTS_REBUILD`, existing organisation `fxwbavdsmcwjhnzgyytl`, region `eu-central-2`.
- Supabase quoted $0/month and cost confirmation completed. Creation was rejected because Cyril556 already has two active free projects.
- Existing active projects: `CCORP_SIRTS` (`tvjyllnfuptdcbirjvev`) and `CCORP_SIRTS_DEV` (`pvtissqcpskpxlduxuta`). Neither was paused, deleted or modified.
- No recovery project ID exists yet. Do not substitute an existing project.

## Completed local checks

- Vite build passes without backend variables and renders setup-pending state.
- Eight automated tests pass, including actual baseline SQL execution in PGlite, five-role profile lookup, anonymous denial, cross-user row access, profile self-promotion denial, direct assignment and workflow restrictions, forged audit denial, and KB/assets write restrictions.
- These checks use isolated synthetic local Auth fixtures, not remote Supabase Auth accounts.
- Browser verification is blocked in this runtime: agent-browser could not start its daemon, Playwright had no Chromium executable, and the browser download timed out. No browser UAT pass is claimed.

## Required live gate — NOT RUN

| Area | Required evidence |
|---|---|
| Fresh infrastructure | New project exists in the correct organisation; migration applied; advisors reviewed |
| Accounts | Approved staff roster; supported Auth Admin creation; every profile has first/last name and expected role |
| Five-role Auth | Successful login, wrong-password failure, refresh persistence, profile/role resolution, logout |
| Admin account creation | Admin session remains the same; unauthenticated and all non-admin calls denied |
| Data/API isolation | All requests go only to the fresh project; direct unauthorized writes fail |
| Incidents | Create, list, detail, assignment, tier status transitions, comments, resolved timestamps, audit |
| Other modules | Dashboard, KB create/read/update/delete, assets create/read/status, reports, audit, accurate empty/error states |
| Realtime | Updates/comments arrive between two authenticated browser sessions; permissions still hold |
| Vercel | Branch-specific Preview variables; stable build; refresh/deep links; desktop/mobile navigation and forms |
| Regression | Full UI and direct API matrix for all five roles; large-list pagination verified |

Do not merge, tag stable, promote to production, or claim restoration is complete until this gate passes.

## Next blocking decision

Free a project slot by explicitly choosing which existing project may be paused, or upgrade the organisation. Pausing an active project interrupts all applications connected to it; this choice was not inferred. Continue with the prepared fresh-project setup after the decision.
