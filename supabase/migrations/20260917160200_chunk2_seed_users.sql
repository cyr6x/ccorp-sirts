-- ============================================================
-- Chunk 2: Demo seed users for CCorp SIRTS
-- Safe to re-run. Run AFTER chunk0a, chunk0b, chunk1.
--
-- Demo credentials (all same password = Demo@1234):
--   alice@ccorp.local   -> ADMIN
--   ben@ccorp.local     -> SOC_LEAD
--   chloe@ccorp.local   -> SOC_ANALYST L1
--   darius@ccorp.local  -> SOC_ANALYST L2
--   eva@ccorp.local     -> SOC_ANALYST L3
-- ============================================================

-- ============================================================
-- STEP 1: Make passwordHash nullable so the handle_new_user()
-- trigger can insert without a NOT NULL constraint violation.
-- We own public.users so ALTER works without superuser.
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
      AND column_name = 'passwordHash' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.users
      ALTER COLUMN "passwordHash" DROP NOT NULL,
      ALTER COLUMN "passwordHash" SET DEFAULT '';
    RAISE NOTICE 'passwordHash: dropped NOT NULL, set DEFAULT empty string';
  END IF;
END $$;

-- ============================================================
-- STEP 2: Upsert into auth.users.
-- handle_new_user fires and creates public.users rows.
-- passwordHash is now nullable so the trigger succeeds.
--
-- Hash = bcrypt("Demo@1234", rounds=10) via bcryptjs.
-- $2b$ prefix is what Supabase Auth expects.
-- ============================================================
DO $$
DECLARE
  _now  TIMESTAMPTZ := NOW();
  _pass TEXT := '$2b$10$Yrd8CoFt1gdqVoJtApjCKONN555DVzKzOcKDhZnjEhv91APd70KzW';
  _alice  UUID := '00000001-0000-0000-0000-000000000001';
  _ben    UUID := '00000002-0000-0000-0000-000000000002';
  _chloe  UUID := '00000003-0000-0000-0000-000000000003';
  _darius UUID := '00000004-0000-0000-0000-000000000004';
  _eva    UUID := '00000005-0000-0000-0000-000000000005';
BEGIN
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_user_meta_data, raw_app_meta_data,
    aud, role, is_super_admin
  ) VALUES
    (_alice,  '00000000-0000-0000-0000-000000000000',
     'alice@ccorp.local',  _pass, _now, _now, _now,
     '{"name":"Alice Chen"}'::jsonb,
     '{"provider":"email","providers":["email"]}'::jsonb,
     'authenticated', 'authenticated', false),
    (_ben,    '00000000-0000-0000-0000-000000000000',
     'ben@ccorp.local',    _pass, _now, _now, _now,
     '{"name":"Ben Torres"}'::jsonb,
     '{"provider":"email","providers":["email"]}'::jsonb,
     'authenticated', 'authenticated', false),
    (_chloe,  '00000000-0000-0000-0000-000000000000',
     'chloe@ccorp.local',  _pass, _now, _now, _now,
     '{"name":"Chloe Park"}'::jsonb,
     '{"provider":"email","providers":["email"]}'::jsonb,
     'authenticated', 'authenticated', false),
    (_darius, '00000000-0000-0000-0000-000000000000',
     'darius@ccorp.local', _pass, _now, _now, _now,
     '{"name":"Darius Webb"}'::jsonb,
     '{"provider":"email","providers":["email"]}'::jsonb,
     'authenticated', 'authenticated', false),
    (_eva,    '00000000-0000-0000-0000-000000000000',
     'eva@ccorp.local',    _pass, _now, _now, _now,
     '{"name":"Eva Singh"}'::jsonb,
     '{"provider":"email","providers":["email"]}'::jsonb,
     'authenticated', 'authenticated', false)
  ON CONFLICT (id) DO UPDATE
    SET encrypted_password = EXCLUDED.encrypted_password,
        email              = EXCLUDED.email,
        raw_user_meta_data = EXCLUDED.raw_user_meta_data,
        updated_at         = NOW();
  RAISE NOTICE 'auth.users: 5 demo accounts upserted.';
END $$;

-- ============================================================
-- STEP 3: Patch the public.users rows the trigger created.
-- Trigger defaults everyone to SOC_ANALYST; fix role + name.
-- ============================================================
UPDATE public.users SET
  name    = 'Alice Chen',
  role_id = 'ADMIN'
WHERE id = '00000001-0000-0000-0000-000000000001';

UPDATE public.users SET
  name    = 'Ben Torres',
  role_id = 'SOC_LEAD'
WHERE id = '00000002-0000-0000-0000-000000000002';

UPDATE public.users SET
  name    = 'Chloe Park L1',
  role_id = 'SOC_ANALYST'
WHERE id = '00000003-0000-0000-0000-000000000003';

UPDATE public.users SET
  name    = 'Darius Webb L2',
  role_id = 'SOC_ANALYST'
WHERE id = '00000004-0000-0000-0000-000000000004';

UPDATE public.users SET
  name    = 'Eva Singh L3',
  role_id = 'SOC_ANALYST'
WHERE id = '00000005-0000-0000-0000-000000000005';

DO $$ BEGIN RAISE NOTICE 'Chunk 2 complete. 5 demo users seeded.'; END $$;
