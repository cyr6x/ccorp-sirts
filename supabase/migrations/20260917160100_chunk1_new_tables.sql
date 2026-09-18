-- ============================================================
-- Chunk 1: Auth trigger, kb_articles, assets, notifications,
--          SOC_ANALYST incident insert policy, RLS for new tables
-- ============================================================

-- 1. Auto-create public.users row on Supabase Auth sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role_id, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'SOC_ANALYST',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. Ensure users.id is UUID-typed to match auth.uid()
-- (If id is TEXT from Prisma, cast safely)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id' AND data_type = 'text'
  ) THEN
    -- Add temp uuid column, migrate, swap
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS id_uuid UUID;
    UPDATE public.users SET id_uuid = id::uuid WHERE id ~ '^[0-9a-f-]{36}$';
    -- Only do the swap if all rows converted cleanly
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id_uuid IS NULL) THEN
      ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_pkey;
      ALTER TABLE public.users DROP COLUMN id;
      ALTER TABLE public.users RENAME COLUMN id_uuid TO id;
      ALTER TABLE public.users ADD PRIMARY KEY (id);
    END IF;
  END IF;
END $$;

-- 3. KB Articles table
CREATE TABLE IF NOT EXISTS public.kb_articles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  summary     TEXT,
  content     TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'OTHER',
  author_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kb_read_all"
  ON public.kb_articles FOR SELECT TO authenticated USING (true);

CREATE POLICY "kb_write_admin_lead"
  ON public.kb_articles FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role_id IN ('ADMIN','SOC_LEAD')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role_id IN ('ADMIN','SOC_LEAD')
  ));

-- 4. Assets table
CREATE TABLE IF NOT EXISTS public.assets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'OTHER',
  ip_address  INET,
  os          TEXT,
  owner       TEXT,
  risk_level  TEXT NOT NULL DEFAULT 'LOW',
  status      TEXT NOT NULL DEFAULT 'ACTIVE',
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assets_read_all"
  ON public.assets FOR SELECT TO authenticated USING (true);

CREATE POLICY "assets_write_admin_lead"
  ON public.assets FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role_id IN ('ADMIN','SOC_LEAD')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role_id IN ('ADMIN','SOC_LEAD')
  ));

-- Allow SOC_ANALYST to update asset status only
CREATE POLICY "assets_update_analyst"
  ON public.assets FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role_id = 'SOC_ANALYST'
  ));

-- 5. Fix SOC_ANALYST incident insert (they need to create incidents)
DROP POLICY IF EXISTS "incidents_insert_analyst" ON public.incidents;
CREATE POLICY "incidents_insert_analyst"
  ON public.incidents FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
  );

-- 6. Allow all authenticated to insert audit_log and comments (RLS only restricts read)
DROP POLICY IF EXISTS "audit_log_insert" ON public.audit_log;
CREATE POLICY "audit_log_insert"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 7. Allow all authenticated to insert incident_updates
DROP POLICY IF EXISTS "incident_updates_insert" ON public.incident_updates;
CREATE POLICY "incident_updates_insert"
  ON public.incident_updates FOR INSERT TO authenticated
  WITH CHECK (changed_by = auth.uid());

-- 8. Ensure notifications table has needed columns
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id TEXT,
  type        TEXT NOT NULL DEFAULT 'SLA_BREACH',
  deadline_at TIMESTAMPTZ,
  notified    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. updated_at auto-trigger for kb_articles and assets
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_kb_articles_updated_at ON public.kb_articles;
CREATE TRIGGER set_kb_articles_updated_at
  BEFORE UPDATE ON public.kb_articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_assets_updated_at ON public.assets;
CREATE TRIGGER set_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
