-- ============================================================
-- Chunk 0b: Prisma column renames, status migration, RLS, triggers
-- Run AFTER chunk0a. Safe to re-run.
-- ============================================================

-- Prisma camelCase column renames + status value migration
DO $$
BEGIN
    -- users
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema=''public'' AND table_name=''users'' AND column_name=''createdAt'') THEN
        ALTER TABLE public.users RENAME COLUMN "createdAt" TO created_at;
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema=''public'' AND table_name=''users'' AND column_name=''role_id'') THEN
        ALTER TABLE public.users ADD COLUMN role_id TEXT REFERENCES public.roles(id) DEFAULT ''SOC_ANALYST'';
    END IF;
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema=''public'' AND table_name=''users'' AND column_name=''role'') THEN
        UPDATE public.users SET role_id = ''ADMIN''       WHERE role::text = ''ADMIN'';
        UPDATE public.users SET role_id = ''SOC_LEAD''    WHERE role::text = ''SOC_LEAD'';
        UPDATE public.users SET role_id = ''SOC_ANALYST'' WHERE role::text NOT IN (''ADMIN'',''SOC_LEAD'');
    END IF;
    -- incidents
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema=''public'' AND table_name=''incidents'' AND column_name=''createdAt'') THEN
        ALTER TABLE public.incidents RENAME COLUMN "createdAt"    TO created_at;
        ALTER TABLE public.incidents RENAME COLUMN "updatedAt"    TO updated_at;
        ALTER TABLE public.incidents RENAME COLUMN "resolvedAt"   TO resolved_at;
        ALTER TABLE public.incidents RENAME COLUMN "assignedToId" TO assigned_to;
        ALTER TABLE public.incidents RENAME COLUMN "createdById"  TO created_by;
    END IF;
    UPDATE public.incidents SET status = ''New''         WHERE status = ''OPEN'';
    UPDATE public.incidents SET status = ''In Progress'' WHERE status = ''IN_PROGRESS'';
    UPDATE public.incidents SET status = ''Assigned''    WHERE status = ''ESCALATED'';
    UPDATE public.incidents SET status = ''Resolved''    WHERE status = ''RESOLVED'';
    UPDATE public.incidents SET status = ''Closed''      WHERE status = ''CLOSED'';
    -- comments
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema=''public'' AND table_name=''comments'' AND column_name=''incidentId'') THEN
        ALTER TABLE public.comments RENAME COLUMN "incidentId" TO incident_id;
        ALTER TABLE public.comments RENAME COLUMN "userId"     TO user_id;
        ALTER TABLE public.comments RENAME COLUMN "createdAt"  TO created_at;
    END IF;
    -- audit_log
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema=''public'' AND table_name=''audit_log'' AND column_name=''incidentId'') THEN
        ALTER TABLE public.audit_log RENAME COLUMN "incidentId" TO incident_id;
        ALTER TABLE public.audit_log RENAME COLUMN "userId"     TO user_id;
        ALTER TABLE public.audit_log RENAME COLUMN "createdAt"  TO created_at;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments         ENABLE ROW LEVEL SECURITY;

-- RLS Policies (DROP IF EXISTS so re-runs are safe)
DROP POLICY IF EXISTS "users_read_all"    ON public.users;
DROP POLICY IF EXISTS "users_write_admin" ON public.users;
CREATE POLICY "users_read_all"    ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "users_write_admin" ON public.users FOR ALL    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role_id = ''ADMIN''));

DROP POLICY IF EXISTS "roles_read_all"    ON public.roles;
DROP POLICY IF EXISTS "roles_write_admin" ON public.roles;
CREATE POLICY "roles_read_all"    ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_write_admin" ON public.roles FOR ALL    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role_id = ''ADMIN''));

DROP POLICY IF EXISTS "incidents_all_admin_lead"  ON public.incidents;
DROP POLICY IF EXISTS "incidents_select_analyst"  ON public.incidents;
DROP POLICY IF EXISTS "incidents_update_analyst"  ON public.incidents;
CREATE POLICY "incidents_all_admin_lead" ON public.incidents FOR ALL    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role_id IN (''ADMIN'',''SOC_LEAD'')));
CREATE POLICY "incidents_select_analyst" ON public.incidents FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role_id = ''SOC_ANALYST'') AND assigned_to = auth.uid());
CREATE POLICY "incidents_update_analyst" ON public.incidents FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role_id = ''SOC_ANALYST'') AND assigned_to = auth.uid());

DROP POLICY IF EXISTS "audit_log_read" ON public.audit_log;
CREATE POLICY "audit_log_read" ON public.audit_log FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.users u JOIN public.roles r ON u.role_id = r.id
        WHERE u.id = auth.uid()
        AND (u.role_id = ''ADMIN'' OR (r.permissions->>''audit_read'')::boolean = true)
    ));

DROP POLICY IF EXISTS "notifications_read" ON public.notifications;
CREATE POLICY "notifications_read" ON public.notifications FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role_id IN (''ADMIN'',''SOC_LEAD'')));

DROP POLICY IF EXISTS "comments_read_all" ON public.comments;
DROP POLICY IF EXISTS "comments_insert"   ON public.comments;
CREATE POLICY "comments_read_all" ON public.comments FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.incidents i WHERE i.id = comments.incident_id));
CREATE POLICY "comments_insert" ON public.comments FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "incident_updates_all_admin_lead" ON public.incident_updates;
CREATE POLICY "incident_updates_all_admin_lead" ON public.incident_updates FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role_id IN (''ADMIN'',''SOC_LEAD'')));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_incidents_updated_at ON public.incidents;
CREATE TRIGGER set_incidents_updated_at
  BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
