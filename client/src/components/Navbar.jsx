import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navLinks = [
  { to: '/dashboard',       label: 'Dashboard',      roles: null,                 icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { to: '/incidents',       label: 'Incidents',      roles: null,                 icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
  { to: '/incidents/new',   label: 'New Incident',   roles: null,                 icon: 'M12 4v16m8-8H4' },
  { to: '/knowledge-base',  label: 'Knowledge Base', roles: null,                 icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { to: '/assets',          label: 'Assets',         roles: null,                 icon: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18' },
  { to: '/reports',         label: 'Reports',        roles: ['ADMIN','SOC_LEAD'], icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { to: '/audit-logs',      label: 'Audit Logs',     roles: ['ADMIN','SOC_LEAD'], icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { to: '/users',           label: 'Users',          roles: ['ADMIN'],            icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
];

const ROLE_COLORS = {
  ADMIN: 'text-red-300',
  SOC_LEAD: 'text-orange-300',
  SOC_ANALYST_L1: 'text-gray-300',
  SOC_ANALYST_L2: 'text-gray-300',
  SOC_ANALYST_L3: 'text-gray-300',
  SOC_ANALYST: 'text-gray-300',
};

const ROLE_LABELS = {
  ADMIN: 'Administrator',
  SOC_LEAD: 'SOC Lead',
  SOC_ANALYST_L1: 'SOC Analyst L1',
  SOC_ANALYST_L2: 'SOC Analyst L2',
  SOC_ANALYST_L3: 'SOC Analyst L3',
  SOC_ANALYST: 'SOC Analyst',
};

export default function Navbar() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!currentUser) return null;

  const visibleLinks = navLinks.filter(link => !link.roles || link.roles.includes(currentUser.role));
  const roleColor = ROLE_COLORS[currentUser.role] ?? 'text-gray-300';
  const roleLabel = ROLE_LABELS[currentUser.role] ?? currentUser.role;

  return (
    <nav className="enterprise-nav sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 flex items-center h-[68px] gap-5">
        <Link to="/dashboard" className="flex items-center gap-3 shrink-0 group">
          <div className="enterprise-brandmark w-9 h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-[1.03]">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v5c0 4.6-2.8 8.7-7 10-4.2-1.3-7-5.4-7-10V6l7-3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 12.2l2.2 2.2 4.8-5" />
            </svg>
          </div>
          <div className="leading-none">
            <div>
              <span className="font-semibold text-white text-sm tracking-[0.02em]">CCorp</span>
              <span className="ml-1.5 font-semibold text-red-400 text-sm">SIRTS</span>
            </div>
            <span className="text-[9px] uppercase tracking-[0.19em] text-gray-600">Security operations</span>
          </div>
        </Link>

        <div className="h-7 w-px bg-white/[0.07] shrink-0" />

        <div className="flex items-center gap-1 flex-1 overflow-x-auto no-scrollbar">
          {visibleLinks.map(link => {
            const active = location.pathname === link.to ||
              (link.to !== '/dashboard' && link.to !== '/incidents/new' && location.pathname.startsWith(link.to));

            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium transition-all whitespace-nowrap ${active ? 'nav-link-active' : 'nav-link-idle'}`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={link.icon} />
                </svg>
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/[0.07] bg-white/[0.025]">
            <span className="signal-dot" />
            <span className="text-[10px] text-gray-500 uppercase tracking-[0.16em] font-semibold">Live fabric</span>
          </div>

          <div className="hidden sm:flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
              <span className="text-xs font-semibold text-gray-200">{currentUser.name?.charAt(0)?.toUpperCase()}</span>
            </div>
            <div className="hidden md:block">
              <p className="text-[13px] font-medium text-gray-100 leading-none">{currentUser.name}</p>
              <p className={`text-[10px] uppercase tracking-[0.12em] leading-none mt-1.5 ${roleColor}`}>{roleLabel}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Sign out"
            className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/[0.04] rounded-md transition-all border border-transparent hover:border-white/[0.07]"
          >
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}
