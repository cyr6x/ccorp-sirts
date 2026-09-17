-- Chunk 0: Supabase Schema Correction + RLS

-- Drop prisma migrations
DROP TABLE IF EXISTS _prisma_migrations;

-- Create Roles table
CREATE TABLE IF NOT EXISTS public.roles (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Seed Roles
INSERT INTO public.roles (id, name, permissions) VALUES
    ('ADMIN', 'ADMIN', '{"audit_read": true, "all_access": true}'::jsonb),
    ('SOC_LEAD', 'SOC_LEAD', '{"audit_read": true}'::jsonb),
    ('SOC_ANALYST', 'SOC_ANALYST', '{}'::jsonb)
ON CONFLICT (id) DO UPDATE SET permissions = EXCLUDED.permissions;

-- Rename Prisma tables if they exist
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'User') THEN
        ALTER TABLE "User" RENAME TO users;
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Incident') THEN
        ALTER TABLE "Incident" RENAME TO incidents;
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'AuditLog') THEN
        ALTER TABLE "AuditLog" RENAME TO audit_log;
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Comment') THEN

-- Adjust users table
ALTER TABLE users RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id TEXT REFERENCES public.roles(id) DEFAULT 'SOC_ANALYST';

DO $$
BEGIN
    -- Only try to update role_id if the old enum role column still exists
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role') THEN
        UPDATE users SET role_id = 'ADMIN' WHERE role::text = 'ADMIN';
        UPDATE users SET role_id = 'SOC_LEAD' WHERE role::text = 'SOC_LEAD';
        UPDATE users SET role_id = 'SOC_ANALYST' WHERE role::text NOT IN ('ADMIN', 'SOC_LEAD');
    END IF;
END $$;
-- NOTE: passwordHash is deliberately kept until Chunk 1 Auth migration is live

-- Adjust incidents table
ALTER TABLE incidents RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE incidents RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE incidents RENAME COLUMN "resolvedAt" TO resolved_at;
ALTER TABLE incidents RENAME COLUMN "assignedToId" TO assigned_to;
ALTER TABLE incidents RENAME COLUMN "createdById" TO created_by;

-- Rename incident status ENUM to match lifecycle language
ALTER TABLE incidents ALTER COLUMN status TYPE TEXT;
DROP TYPE IF EXISTS "IncidentStatus";
CREATE TYPE incident_status AS ENUM ('New', 'Assigned', 'In Progress', 'Resolved', 'Closed');

UPDATE incidents SET status = 'New' WHERE status = 'OPEN';
UPDATE incidents SET status = 'In Progress' WHERE status = 'IN_PROGRESS';
UPDATE incidents SET status = 'Assigned' WHERE status = 'ESCALATED';
UPDATE incidents SET status = 'Resolved' WHERE status = 'RESOLVED';
UPDATE incidents SET status = 'Closed' WHERE status = 'CLOSED';

ALTER TABLE incidents ALTER COLUMN status TYPE incident_status USING status::incident_status;
ALTER TABLE incidents ALTER COLUMN status SET DEFAULT 'New'::incident_status;

        ALTER TABLE "Comment" RENAME TO comments;
    END IF;

-- Creates incident_updates table
CREATE TABLE IF NOT EXISTS public.incident_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id TEXT REFERENCES public.incidents(id) ON DELETE CASCADE,
    changed_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    field_changed TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Creates notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id TEXT REFERENCES public.incidents(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deadline_at TIMESTAMP WITH TIME ZONE,
    notified BOOLEAN DEFAULT FALSE,
    notified_at TIMESTAMP WITH TIME ZONE
);

-- Trigger to auto-insert a notification for CRITICAL or HIGH severity incidents
CREATE OR REPLACE FUNCTION trg_insert_notification()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.severity::text IN ('CRITICAL', 'HIGH') THEN
        INSERT INTO public.notifications (incident_id, created_at, deadline_at)
        VALUES (NEW.id, NEW.created_at, NEW.created_at + INTERVAL '72 hours');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_incident_severity_notification ON public.incidents;
CREATE TRIGGER trg_incident_severity_notification
AFTER INSERT ON public.incidents
FOR EACH ROW
EXECUTE FUNCTION trg_insert_notification();

-- Adjust audit_log table
ALTER TABLE audit_log RENAME COLUMN "incidentId" TO incident_id;
ALTER TABLE audit_log RENAME COLUMN "userId" TO user_id;
ALTER TABLE audit_log RENAME COLUMN "timestamp" TO created_at;

-- Adjust comments table (used in later chunks but exists in current db)
ALTER TABLE comments RENAME COLUMN "incidentId" TO incident_id;
ALTER TABLE comments RENAME COLUMN "userId" TO user_id;
ALTER TABLE comments RENAME COLUMN "createdAt" TO created_at;

END $$;

-- ENABLE RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES

-- users, roles: readable by all authenticated users; writable by Admin only.
CREATE POLICY "users_read_all" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "users_write_admin" ON public.users FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id::uuid = auth.uid() AND u.role_id = 'ADMIN')
);

CREATE POLICY "roles_read_all" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_write_admin" ON public.roles FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id::uuid = auth.uid() AND u.role_id = 'ADMIN')
);

-- incidents: SOC Analyst can only SELECT/UPDATE rows where assigned_to = auth.uid(). SOC Lead and Admin: full access.
CREATE POLICY "incidents_all_admin_lead" ON public.incidents FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id::uuid = auth.uid() AND u.role_id IN ('ADMIN', 'SOC_LEAD'))
);
CREATE POLICY "incidents_select_analyst" ON public.incidents FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id::uuid = auth.uid() AND u.role_id = 'SOC_ANALYST') 
    AND assigned_to = (SELECT auth.uid()::text)
);
CREATE POLICY "incidents_update_analyst" ON public.incidents FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id::uuid = auth.uid() AND u.role_id = 'SOC_ANALYST') 
    AND assigned_to = (SELECT auth.uid()::text)
);

-- audit_log: default read restricted to Admin; SOC Lead gets read access via audit_read permission
CREATE POLICY "audit_log_read" ON public.audit_log FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.users u JOIN public.roles r ON u.role_id = r.id 
        WHERE u.id::uuid = auth.uid() AND (u.role_id = 'ADMIN' OR r.permissions->>'audit_read' = 'true')
    )
);

-- notifications: readable by Admin and SOC Lead only
CREATE POLICY "notifications_read" ON public.notifications FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id::uuid = auth.uid() AND u.role_id IN ('ADMIN', 'SOC_LEAD'))
);

-- comments: any authenticated can select for incidents they can access.
CREATE POLICY "comments_read_all" ON public.comments FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.incidents i WHERE i.id = comments.incident_id)
);
CREATE POLICY "comments_insert" ON public.comments FOR INSERT TO authenticated WITH CHECK (
    user_id = (SELECT auth.uid()::text)
);

-- incident_updates: readable and writable same as incidents (approx)
-- We will just give Admin/Lead full, and Analyst based on assignment for simplicity
CREATE POLICY "incident_updates_all_admin_lead" ON public.incident_updates FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id::uuid = auth.uid() AND u.role_id IN ('ADMIN', 'SOC_LEAD'))
);


