-- ============================================================
-- Chunk 0a: Roles, tables, column renames
-- Safe to re-run (IF EXISTS / IF NOT EXISTS guards throughout)
-- ============================================================

DROP TABLE IF EXISTS _prisma_migrations;

-- Roles
CREATE TABLE IF NOT EXISTS public.roles (
    id          TEXT PRIMARY KEY,
    name        TEXT UNIQUE NOT NULL,
    permissions JSONB NOT NULL DEFAULT ''{}''::jsonb
);

INSERT INTO public.roles (id, name, permissions) VALUES
    (''ADMIN'',       ''ADMIN'',       ''{"audit_read": true, "all_access": true}''::jsonb),
    (''SOC_LEAD'',    ''SOC_LEAD'',    ''{"audit_read": true}''::jsonb),
    (''SOC_ANALYST'', ''SOC_ANALYST'', ''{}''::jsonb)
ON CONFLICT (id) DO UPDATE SET permissions = EXCLUDED.permissions;

-- Rename Prisma tables if still under old names
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname=''public'' AND tablename=''User'')     THEN ALTER TABLE public."User"     RENAME TO users;    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname=''public'' AND tablename=''Incident'') THEN ALTER TABLE public."Incident" RENAME TO incidents; END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname=''public'' AND tablename=''AuditLog'') THEN ALTER TABLE public."AuditLog" RENAME TO audit_log; END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname=''public'' AND tablename=''Comment'')  THEN ALTER TABLE public."Comment"  RENAME TO comments;  END IF;
END $$;

-- Core tables (no-op if already exist)
CREATE TABLE IF NOT EXISTS public.users (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email      TEXT UNIQUE NOT NULL,
    name       TEXT,
    role_id    TEXT REFERENCES public.roles(id) DEFAULT ''SOC_ANALYST'',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.incidents (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title          TEXT NOT NULL,
    description    TEXT,
    category       TEXT NOT NULL DEFAULT ''OTHER'',
    severity       TEXT NOT NULL DEFAULT ''MEDIUM'',
    status         TEXT NOT NULL DEFAULT ''New'',
    source_ip      TEXT,
    affected_asset TEXT,
    created_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
    assigned_to    UUID REFERENCES public.users(id) ON DELETE SET NULL,
    resolved_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.comments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID REFERENCES public.incidents(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID REFERENCES public.incidents(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action      TEXT NOT NULL,
    details     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.incident_updates (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id   UUID REFERENCES public.incidents(id) ON DELETE CASCADE,
    changed_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
    field_changed TEXT NOT NULL,
    old_value     TEXT,
    new_value     TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID REFERENCES public.incidents(id) ON DELETE CASCADE,
    type        TEXT NOT NULL DEFAULT ''SLA_BREACH'',
    deadline_at TIMESTAMPTZ,
    notified    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
