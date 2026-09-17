-- ============================================================
-- Chunk 2: Demo seed users for CCorp SIRTS
-- Creates 5 demo accounts in auth.users + public.users
-- Safe to re-run (ON CONFLICT DO NOTHING / DO UPDATE)
-- Run AFTER chunk0a, chunk0b, chunk1
-- ============================================================

-- Enable pgcrypto if not already (needed for gen_salt / crypt)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================
-- SEED USERS
-- Emails / passwords shown in the login page demo panel
--
--  alice@ccorp.local     / Demo@1234  -> ADMIN
--  ben@ccorp.local       / Demo@1234  -> SOC_LEAD
--  chloe@ccorp.local     / Demo@1234  -> SOC_ANALYST  (L1 Tier)
--  darius@ccorp.local    / Demo@1234  -> SOC_ANALYST  (L2 Tier)
--  eva@ccorp.local       / Demo@1234  -> SOC_ANALYST  (L3 Tier)
-- ============================================================

DO $$
DECLARE
  _now   TIMESTAMPTZ := NOW();
  _pass  TEXT        := extensions.crypt('Demo@1234', extensions.gen_salt('bf'));

  _alice  UUID := '00000001-0000-0000-0000-000000000001';
  _ben    UUID := '00000002-0000-0000-0000-000000000002';
  _chloe  UUID := '00000003-0000-0000-0000-000000000003';
  _darius UUID := '00000004-0000-0000-0000-000000000004';
  _eva    UUID := '00000005-0000-0000-0000-000000000005';
BEGIN

  -- ── auth.users ──────────────────────────────────────────────
  -- Insert into Supabase's internal auth.users table.
  -- confirmed_at = _now skips email-confirmation requirement.
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_user_meta_data, raw_app_meta_data,
    aud, role, is_super_admin
  ) VALUES
    -- ADMIN
    (_alice,  '00000000-0000-0000-0000-000000000000',
     'alice@ccorp.local',  _pass, _now, _now, _now,
     '{"name":"Alice Chen"}'::jsonb,  '{"provider":"email","providers":["email"]}'::jsonb,
     'authenticated', 'authenticated', false),
    -- SOC_LEAD
    (_ben,    '00000000-0000-0000-0000-000000000000',
     'ben@ccorp.local',    _pass, _now, _now, _now,
     '{"name":"Ben Torres"}'::jsonb,  '{"provider":"email","providers":["email"]}'::jsonb,
     'authenticated', 'authenticated', false),
    -- SOC_ANALYST L1
    (_chloe,  '00000000-0000-0000-0000-000000000000',
     'chloe@ccorp.local',  _pass, _now, _now, _now,
     '{"name":"Chloe Park (L1)"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb,
     'authenticated', 'authenticated', false),
    -- SOC_ANALYST L2
    (_darius, '00000000-0000-0000-0000-000000000000',
     'darius@ccorp.local', _pass, _now, _now, _now,
     '{"name":"Darius Webb (L2)"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb,
     'authenticated', 'authenticated', false),
    -- SOC_ANALYST L3
    (_eva,    '00000000-0000-0000-0000-000000000000',
     'eva@ccorp.local',    _pass, _now, _now, _now,
     '{"name":"Eva Singh (L3)"}'::jsonb,  '{"provider":"email","providers":["email"]}'::jsonb,
     'authenticated', 'authenticated', false)
  ON CONFLICT (id) DO UPDATE
    SET encrypted_password  = EXCLUDED.encrypted_password,
        email               = EXCLUDED.email,
        raw_user_meta_data  = EXCLUDED.raw_user_meta_data,
        updated_at          = NOW();

  -- ── public.users ────────────────────────────────────────────
  -- Upsert profile rows (the trigger normally does this on INSERT,
  -- but since we're inserting directly we handle it here too)
  INSERT INTO public.users (id, email, name, role_id, created_at)
  VALUES
    (_alice,  'alice@ccorp.local',  'Alice Chen',        'ADMIN',       _now),
    (_ben,    'ben@ccorp.local',    'Ben Torres',        'SOC_LEAD',    _now),
    (_chloe,  'chloe@ccorp.local',  'Chloe Park (L1)',   'SOC_ANALYST', _now),
    (_darius, 'darius@ccorp.local', 'Darius Webb (L2)',  'SOC_ANALYST', _now),
    (_eva,    'eva@ccorp.local',    'Eva Singh (L3)',    'SOC_ANALYST', _now)
  ON CONFLICT (id) DO UPDATE
    SET name    = EXCLUDED.name,
        role_id = EXCLUDED.role_id,
        email   = EXCLUDED.email;

  RAISE NOTICE 'Demo seed users upserted successfully.';
END $$;
