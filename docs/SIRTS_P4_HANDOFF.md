# SIRTS P4 Handoff

## Final project decision

The SIRTS build is frozen for this final-year project. Do not add features, open another regression cycle, create a paid Supabase branch, or pursue production-grade infrastructure. Move to the next academic phase using the existing C2 release and evidence already collected. The only remaining site setup is adding the three Vercel Production variables below so the deployed frontend can reach its already-migrated Supabase project.

## Release to verify

| Item | Current value |
|---|---|
| Repository | `cyr6x/ccorp-sirts` |
| P4 source | `main`, C2 commit `abd5062d9de7633d517a6fcaa1c64a898e950ea5` |
| Production URL | `https://ccorp-sirts.vercel.app` |
| Production deployment | `dpl_BNPt4vuEbfcrcyrb5JdKTK1dG2C3` (READY, C2) |
| Existing Supabase BaaS | `cudagansojpjtligqewe` |
| Hosted migration head | `20260922233443_final_freeze_rpc_privileges` |

Production is currently built but shows “Backend setup pending” until its Vercel Production environment is configured. The hosted migration head matches C2. The GitHub branch `codex/sirts-c3-preview` is an optional candidate, not the release to use; its new breach-assessment table was never applied to Supabase.

## Restore the C2 production connection

In Vercel, open **ccorp-sirts → Settings → Environment Variables**. Add or edit these three variables for **Production**. The URL and project reference are exact; use the active `sb_publishable_` key for project `cudagansojpjtligqewe` from Supabase **Settings → API Keys → default (Publishable)**. Do not use a secret/service-role key.

```env
VITE_SUPABASE_URL=https://cudagansojpjtligqewe.supabase.co
VITE_SUPABASE_PROJECT_REF=cudagansojpjtligqewe
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_7Ku7K5tORIuWqZt8HeX5Lg_8ZyZKxbG
```

Save, then redeploy the latest Production deployment from `main`. In a private browser window, confirm the normal SIRTS login page appears instead of “Backend setup pending.” Use the demo credentials only from the separately supplied submission README; never include passwords in this handoff or Git. This is a deployment configuration step, not another code change.

This only restores the existing frontend-to-Supabase connection. It does not alter schema or records. Do not promote `codex/sirts-c3-preview` or run its migration as part of this step.

## Evidence and limits

The C3 candidate passed `npm ci`, all 24 automated tests, and `npm run build`; its isolated Vercel Preview build reached READY. Its added breach-assessment migration was tested locally but never applied to the hosted database. These results are evidence for the candidate only, not proof that a hosted C3 workflow was tested.

After configuring Production, do one practical smoke check: open the site privately, sign in with the separately supplied demo account, and confirm the dashboard and main modules load. If those work, record the date and proceed. Do not turn this into another full regression programme. Do not delete existing records or alter user roles during the check.

In the report, describe the hosted C2 KDPA timer accurately: it is severity/incident-time based and does not implement a human breach assessment. Do not call it legally compliant. The optional C3 workflow is not part of the release and can be omitted from the product claims.

## Academic report handoff

The supplied final-report guidance specifies a 6,500-word Level 6 report, due **30 November 2026 at 9:00 UK time**, with chapters for Introduction/Aims/Objectives, Research, Analysis, Design, Implementation, Testing/Results, and Conclusions/Future Work, followed by Harvard references and appendices. It also requires a source-code/database archive with tested installation/run instructions and minimum system specifications, plus a 10-minute product demonstration.

The proposal and interim feedback both awarded 80%. The interim feedback specifically asks for interface screenshots, expected/actual test evidence, security-test results, usability evaluation if genuinely conducted, performance evaluation, limitations, and selected security code examples. Do not invent participants, UAT/SUS results, penetration testing, compliance certification, or legal compliance. Mark work not actually conducted as such and discuss the limitation honestly.

Proceed to the next report/evaluation phase after the short smoke check. Use the interim report's original aims and objectives as the comparison baseline; explain any scope change and the actual extent each objective was achieved. Do not invent usability participants, UAT/SUS results, penetration testing, compliance certification, or legal compliance. State only evidence actually collected and move on; additional engineering tests are not a prerequisite for the academic report.
