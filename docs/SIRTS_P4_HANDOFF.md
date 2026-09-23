# SIRTS P4 Handoff

## Decision

Move to P4 verification against the existing C2 release. This is a final-year project; no paid Supabase branch or production-grade infrastructure work is required. Do not apply the C3 migration or merge the C3 branch for P4.

## Release to verify

| Item | Current value |
|---|---|
| Repository | `cyr6x/ccorp-sirts` |
| P4 source | `main`, C2 commit `abd5062d9de7633d517a6fcaa1c64a898e950ea5` |
| Production URL | `https://ccorp-sirts.vercel.app` |
| Production deployment | `dpl_BNPt4vuEbfcrcyrb5JdKTK1dG2C3` (READY, C2) |
| Existing Supabase BaaS | `cudagansojpjtligqewe` |
| Hosted migration head | `20260922233443_final_freeze_rpc_privileges` |

Production is currently built but shows “Backend setup pending” until its Vercel Production environment is configured. The GitHub branch `codex/sirts-c3-preview` (commit `9382d79d836d609636cb66cc088ea9131607dafe`) is a separate candidate, not the P4 release. Its new breach-assessment table is not in the hosted database.

## Restore the C2 production connection

In Vercel, open **ccorp-sirts → Settings → Environment Variables**. Add or edit these three variables for **Production**. The URL and project reference are exact; use the active `sb_publishable_` key for project `cudagansojpjtligqewe` from Supabase **Settings → API Keys → default (Publishable)**. Do not use a secret/service-role key.

```env
VITE_SUPABASE_URL=https://cudagansojpjtligqewe.supabase.co
VITE_SUPABASE_PROJECT_REF=cudagansojpjtligqewe
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_7Ku7K5tORIuWqZt8HeX5Lg_8ZyZKxbG
```

Save, then redeploy the latest Production deployment from `main`. In a private browser window, confirm the normal SIRTS login page appears instead of “Backend setup pending.” Use the demo credentials only from the separately supplied submission README; never include passwords in this handoff or Git.

This only restores the existing frontend-to-Supabase connection. It does not alter schema or records. Do not promote `codex/sirts-c3-preview` or run its migration as part of this step.

## P4 verification focus

Use the restored C2 URL and record actual expected/observed outcomes. At minimum check: anonymous deep-link denial; each available role’s navigation and scope; incident list/detail; incident creation and refresh persistence; lifecycle/assignment; comments/history; dashboard and operational SLA; reports filters and CSV; KB; assets; audit; user management restriction; sign-out; and narrow-screen usability.

Keep evidence proportionate: screenshots of principal screens and errors/empty states, a concise role/action matrix, test date/browser/viewport, and expected versus actual outcomes. Avoid deleting records or changing existing user roles. If a test needs a database write, use an identifiable test item and ask before any cleanup. Do not call the current KDPA timer legally compliant: the hosted C2 implementation is severity/incident-time based, not a human breach assessment.

The C3 branch contains optional local work for formula-safe CSV/race regression and a human-led breach-assessment workflow. Its local clean-chain tests (24 passing) and Vite build passed; its migration was **not** applied to Supabase. It is not needed to finish P4 or the academic report.

## Academic report handoff

The supplied final-report guidance specifies a 6,500-word Level 6 report, due **30 November 2026 at 9:00 UK time**, with chapters for Introduction/Aims/Objectives, Research, Analysis, Design, Implementation, Testing/Results, and Conclusions/Future Work, followed by Harvard references and appendices. It also requires a source-code/database archive with tested installation/run instructions and minimum system specifications, plus a 10-minute product demonstration.

The proposal and interim feedback both awarded 80%. The interim feedback specifically asks for interface screenshots, expected/actual test evidence, security-test results, usability evaluation if genuinely conducted, performance evaluation, limitations, and selected security code examples. Do not invent participants, UAT/SUS results, penetration testing, compliance certification, or legal compliance. Mark work not actually conducted as such and discuss the limitation honestly.

After P4 evidence has been collected and reviewed, proceed to the next report/evaluation phase. The interim report's original aims and objectives remain the comparison baseline; explain any scope change and the actual extent each objective was achieved.
