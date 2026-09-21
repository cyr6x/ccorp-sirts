# Backup and restoration runbook

## Release gate

SIRTS is not production-ready until this runbook has a completed evidence record. A Git branch or Vercel deployment is not a database backup.

## Proposed service objectives — owner approval required

| Objective | Proposed target | Evidence required |
| --- | --- | --- |
| RPO | 24 hours or less | Timestamp of the last verified encrypted backup before a restore test |
| RTO | 4 hours or less | Measured elapsed time for an isolated restore and application smoke test |
| Retention | 30 daily backup points | Retention configuration and encrypted storage location |
| Owner | SIRTS project owner plus named technical custodian | Named people and tested access path |

These are proposed operating targets, not claims that the current Free Supabase project meets them.

## Required backup scope

- PostgreSQL data and schema, including `auth` and `public` data.
- Supabase Auth configuration, URL/redirect configuration and enabled providers, recorded without secrets.
- Edge Function source and deployed version.
- Vercel environment-key inventory and deployment SHA, without values.
- Storage objects separately if Storage is introduced; database backups only contain Storage metadata.

## Restore drill — use an isolated project only

1. Record release SHA, migration ledger, row counts, RLS policy count and current Auth/Edge Function configuration.
2. Create an encrypted logical backup using an access-controlled service account or use a provider-supported backup that meets the approved RPO.
3. Restore into a new isolated Supabase project; never restore over the active project for the drill.
4. Apply the same Edge Function and non-secret configuration, then configure a non-production Vercel preview.
5. Verify row counts, migration versions, RLS denial for anonymous users, role-scoped incident reads, staff provisioning and a report export.
6. Record start/end times, data-loss window, deviations and corrective actions. Attach the evidence to the release SHA.

## Recovery decision

For an actual incident, the release approver decides between rollback (application-only) and restore (data loss/downtime risk). Do not run a restore without a documented incident decision and maintenance window.
