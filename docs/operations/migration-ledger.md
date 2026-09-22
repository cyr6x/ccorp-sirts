# Migration ledger

The checked-in migration versions below match the hosted `CCORP_SIRTS_REBUILD` history captured on 21 September 2026. Do not replay, reset or repair migration history without comparing the schema and release SHA first.

| Version | Name |
| --- | --- |
| 20260919135133 | fresh_sirts_baseline |
| 20260919135355 | split_management_policies |
| 20260919135856 | allow_auth_profile_trigger |
| 20260919135938 | relocate_auth_profile_trigger |
| 20260919140222 | lock_new_profiles_until_role_assignment |
| 20260919192638 | complete_live_feature_wiring |
| 20260919192801 | index_incident_assets_added_by |
| 20260919193710 | enforce_one_kb_article_per_incident |
| 20260921082100 | production_readiness_deadlines_and_audit |
| 20260922233410 | final_freeze_integrity |
| 20260922233443 | final_freeze_rpc_privileges |

Before applying the next migration, compare the hosted migration list to this ledger and confirm that the pending migration is the only difference.
