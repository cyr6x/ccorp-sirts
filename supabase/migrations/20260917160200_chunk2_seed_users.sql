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

-- Step 1: Drop the Prisma-legacy passwordHash NOT NULL constraint.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
      AND column_name = 'passwordHash' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.users ALTER COLUMN "passwordHash" DROP NOT NULL;
    ALTER TABLE public.users ALTER COLUMN "passwordHash" SET DEFAULT '';
    RAISE NOTICE 'Dropped NOT NULL on public.users.passwordHash';
  END IF;
END $$;

-- Step 2: Disable the handle_new_user trigger during auth.users insert
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;

-- Step 3: Upsert auth.users with real bcrypt hash of Demo@1234
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
    (_alice, '00000000-0000-0000-0000-000000000000',
     'alice@ccorp.local', _pass, _now, _now, _now,
     '{"name":"Alice Chen"}'::jsonb,
     '{"provider":"email","providers":["email"]}'::jsonb,
     'authenticated', 'authenticated', false),
    (_ben, '00000000-0000-0000-0000-000000000000',
     'ben@ccorp.local', _pass, _now, _now, _now,
     '{"name":"Ben Torres"}'::jsonb,
     '{"provider":"email","providers":["email"]}'::jsonb,
     'authenticated', 'authenticated', false),
    (_chloe, '00000000-0000-0000-0000-000000000000',
     'chloe@ccorp.local', _pass, _now, _now, _now,
     '{"name":"Chloe Park"}'::jsonb,
     '{"provider":"email","providers":["email"]}'::jsonb,
     'authenticated', 'authenticated', false),
    (_darius, '00000000-0000-0000-0000-000000000000',
     'darius@ccorp.local', _pass, _now, _now, _now,
     '{"name":"Darius Webb"}'::jsonb,
     '{"provider":"email","providers":["email"]}'::jsonb,
     'authenticated', 'authenticated', false),
    (_eva, '00000000-0000-0000-0000-000000000000',
     'eva@ccorp.local', _pass, _now, _now, _now,
     '{"name":"Eva Singh"}'::jsonb,
     '{"provider":"email","providers":["email"]}'::jsonb,
     'authenticated', 'authenticated', false)
  ON CONFLICT (id) DO UPDATE
    SET encrypted_password = EXCLUDED.encrypted_password,
        email = EXCLUDED.email,
        raw_user_meta_data = EXCLUDED.raw_user_meta_data,
        updated_at = NOW();
  RAISE NOTICE 'auth.users: 5 demo accounts upserted.';
END $$;

-- Step 4: Re-enable the trigger for future sign-ups
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;

-- Step 5: Upsert public.users profile rows
DO $$
DECLARE
  _now TIMESTAMPTZ := NOW();
  _alice  UUID := '00000001-0000-0000-0000-000000000001';
  _ben    UUID := '00000002-0000-0000-0000-000000000002';
  _chloe  UUID := '00000003-0000-0000-0000-000000000003';
  _darius UUID := '00000004-0000-0000-0000-000000000004';
  _eva    UUID := '00000005-0000-0000-0000-000000000005';
  _has_ph BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
      AND column_name = 'passwordHash'
  ) INTO _has_ph;

  IF _has_ph THEN
    INSERT INTO public.users (id, email, name, "passwordHash", role_id, created_at)
    VALUES
      (_alice, 'alice@ccorp.local', 'Alice Chen', '', 'ADMIN', _now),
      (_ben, 'ben@ccorp.local', 'Ben Torres', '', 'SOC_LEAD', _now),
      (_chloe, 'chloe@ccorp.local', 'Chloe Park L1', '', 'SOC_ANALYST', _now),
      (_darius, 'darius@ccorp.local', 'Darius Webb L2', '', 'SOC_ANALYST', _now),
      (_eva, 'eva@ccorp.local', 'Eva Singh L3', '', 'SOC_ANALYST', _now)
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, role_id = EXCLUDED.role_id, email = EXCLUDED.email;
  ELSE
    INSERT INTO public.users (id, email, name, role_id, created_at)
    VALUES
      (_alice, 'alice@ccorp.local', 'Alice Chen', 'ADMIN', _now),
      (_ben, 'ben@ccorp.local', 'Ben Torres', 'SOC_LEAD', _now),
      (_chloe, 'chloe@ccorp.local', 'Chloe Park L1', 'SOC_ANALYST', _now),
      (_darius, 'darius@ccorp.local', 'Darius Webb L2', 'SOC_ANALYST', _now),
      (_eva, 'eva@ccorp.local', 'Eva Singh L3', 'SOC_ANALYST', _now)
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, role_id = EXCLUDED.role_id, email = EXCLUDED.email;
  END IF;
  RAISE NOTICE 'public.users: 5 demo profile rows upserted.';
END $$;
