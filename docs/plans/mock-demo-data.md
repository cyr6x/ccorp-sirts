# Mock demonstration data

## Outcome

Make the isolated SIRTS rebuild feel operational without importing real people, production data or old-system records.

## Scope and decisions

- Preserve Sarah Namusoke and Cyril Okello exactly as they are.
- Add six fictional Auth-backed users across SOC Lead and L1–L3 roles. Surnames are initials and addresses use the reserved `demo.ccorp.example` domain.
- Seed deterministic, interconnected assets, incidents, assignments, comments, incident history, knowledge articles and audit evidence. SLA notifications remain database-triggered. Reports remain derived from incidents because the product has no reports table.
- Represent business departments through the existing asset `owner` field and incident context. Do not add an unsupported department field to profiles.
- Use only reserved documentation source-IP ranges and private asset addresses.

## Safety and repeatability

- Run only against `CCORP_SIRTS_REBUILD` (`cudagansojpjtligqewe`) after an exact project-ref confirmation.
- Keep the secret key and demo password in ignored environment configuration; never put either in Git or browser code.
- Provision users through Supabase Auth Admin so the existing locked-profile trigger remains authoritative.
- Use deterministic operational UUIDs. On rerun, verify matching records and skip them; abort on any collision or mismatch instead of overwriting.
- Snapshot every non-demo profile before provisioning and verify it is byte-for-byte unchanged afterward.
- Do not add, alter or relax any RLS policy.

## Verification

- Unit-check fictional identity rules, foreign-key relationships, reserved addresses and reporting coverage.
- Execute the existing migration/RLS test suite.
- After remote seeding, sign in as every new role and verify incident scoping, shared asset/knowledge reads, management audit access and analyst audit denial.
- Run the production build.
