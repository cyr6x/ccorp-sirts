# CCorp SIRTS

**Security Incident Response & Ticketing System** — final year project for BSc (Hons) Cybersecurity & Networking.

A full-stack SOC ticketing tool built on React + Supabase: report, triage, and resolve security incidents with role-based access control, a live operations dashboard, SLA tracking, knowledge base, asset inventory, and a full immutable audit log.

Mapped to NIST SP 800-61 incident response lifecycle (Identify → Contain → Eradicate → Recover → Lessons Learned).

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         BROWSER                              │
│     React 18 + Vite + Tailwind CSS + Recharts                │
│                                                              │
│  Login │ Dashboard │ Incidents │ Detail │ KB │ Assets │ Audit│
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTPS + Supabase JWT (anon key)
┌────────────────────────▼─────────────────────────────────────┐
│                  SUPABASE (BaaS)                              │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  Auth       │  │  PostgREST   │  │  Realtime          │  │
│  │  (email +   │  │  (REST API   │  │  (WebSocket push   │  │
│  │   password) │  │   over RLS)  │  │   on INSERT/UPDATE)│  │
│  └─────────────┘  └──────────────┘  └────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │               PostgreSQL Database                      │  │
│  │  users │ roles │ incidents │ comments │ audit_log      │  │
│  │  incident_updates │ notifications │ kb_articles        │  │
│  │  assets                                                │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, React Router v6, Recharts |
| **Backend / Auth** | Supabase (PostgREST + Auth + Realtime) |
| **Database** | PostgreSQL (hosted on Supabase) |
| **Auth** | Supabase Auth — email/password, JWT |
| **Realtime** | Supabase Realtime — WebSocket subscriptions |
| **Access Control** | Row Level Security (RLS) policies per role |

---

## Key Features

- **Role-Based Access Control** — ADMIN, SOC_LEAD, SOC_ANALYST with RLS-enforced data scoping
- **Incident Lifecycle** — Create, assign, update, escalate, resolve, close with full audit trail
- **Live Dashboard** — Bar/pie charts (by day, category, severity), MTTR, KDPA deadline alerts
- **SLA Tracking** — Per-severity targets (CRITICAL 4h, HIGH 8h, MEDIUM 24h, LOW 72h) with breach indicators
- **Knowledge Base** — SOC playbooks and threat intel articles; create/edit for Lead/Admin
- **Asset Inventory** — Register and track servers, workstations, network devices with risk levels
- **Audit Logs** — Immutable paginated log of every action, gated by `audit_read` permission
- **Reports & Analytics** — Filterable by date range; resolution rate, MTTR, by-category breakdown
- **Realtime Updates** — Incident list and detail pages update live via Supabase WebSocket channels
- **User Management** — Admin can add users and change roles in-app

---

## Project Structure

```
ccorp-sirts/
├── client/                      # React frontend (Vite)
│   ├── .env                     # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (not committed)
│   ├── .env.example             # Template
│   └── src/
│       ├── lib/
│       │   └── supabaseClient.js    # Singleton Supabase client
│       ├── context/
│       │   └── AuthContext.jsx      # Session restore, onAuthStateChange, profile fetch
│       ├── components/
│       │   └── Navbar.jsx           # Role-gated nav links
│       └── pages/
│           ├── LoginPage.jsx
│           ├── DashboardPage.jsx
│           ├── IncidentsPage.jsx        # + Realtime INSERT/UPDATE
│           ├── IncidentDetailPage.jsx   # + Realtime comments + status push
│           ├── NewIncidentPage.jsx
│           ├── UsersPage.jsx
│           ├── ReportsPage.jsx
│           ├── KnowledgeBasePage.jsx
│           ├── KnowledgeBaseArticlePage.jsx
│           ├── AssetsPage.jsx
│           └── AuditLogsPage.jsx
└── supabase/
    └── migrations/
        ├── 20260917160000_chunk0_schema.sql   # Table renames, status enum, RLS policies, triggers
        └── 20260917160100_chunk1_new_tables.sql # Auth trigger, kb_articles, assets, policy fixes
```

---

## Getting Started

### 1. Clone

```bash
git clone https://github.com/baaya/ccorp-sirts.git
cd ccorp-sirts
```

### 2. Install frontend dependencies

```bash
cd client && npm install
```

### 3. Configure environment

```bash
# client/.env  (never commit — already in .gitignore)
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
```

Both values are in your Supabase dashboard → Settings → API.

### 4. Run migrations

In the Supabase SQL editor, run (in order):

1. `supabase/migrations/20260917160000_chunk0_schema.sql`
2. `supabase/migrations/20260917160100_chunk1_new_tables.sql`

Or via the Supabase CLI:

```bash
supabase db push
```

### 5. Create users

In Supabase dashboard → Authentication → Users, create at least one user.
The trigger in chunk1 automatically creates their `public.users` row.
Update their `role_id` to `ADMIN` in the Table Editor to get full access.

### 6. Run the dev server

```bash
cd client && npm run dev
```

Open http://localhost:3000

---

## Roles

| Role | Access |
|---|---|
| `ADMIN` | Full access to all modules including Users, Audit Logs, Reports |
| `SOC_LEAD` | All incident ops + Audit Logs + Reports; no user management |
| `SOC_ANALYST` | Create incidents; view/update only incidents assigned to them (enforced by RLS) |

---

## SLA Targets

| Severity | Target | Colour |
|---|---|---|
| CRITICAL | 4 hours | Red |
| HIGH | 8 hours | Orange |
| MEDIUM | 24 hours | Yellow |
| LOW | 72 hours | Green |

SLA breach indicators appear on the incident list and detail pages.

---

## What this demonstrates

Final year project for BSc (Hons) Cybersecurity and Networking. Combines incident response process (NIST SP 800-61) with secure full-stack development: Supabase Auth JWT sessions, Row Level Security enforcing role-based data access at the database layer, realtime WebSocket subscriptions, and a complete CRUD lifecycle across 8 modules — all without a custom backend server.

---

## License

MIT — academic use permitted with attribution.
