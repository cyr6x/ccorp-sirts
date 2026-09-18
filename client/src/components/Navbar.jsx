import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navLinks = [
  { to: '/dashboard', label: 'Overview', roles: null },
  { to: '/incidents', label: 'Incidents', roles: null },
  { to: '/incidents/new', label: 'Create', roles: null },
  { to: '/knowledge-base', label: 'Knowledge', roles: null },
  { to: '/assets', label: 'Assets', roles: null },
  { to: '/reports', label: 'Reports', roles: ['ADMIN','SOC_LEAD'] },
  { to: '/audit-logs', label: 'Audit', roles: ['ADMIN','SOC_LEAD'] },
  { to: '/users', label: 'Users', roles: ['ADMIN'] },
];

const ROLE_LABELS = {
  ADMIN: 'Administrator',
  SOC_LEAD: 'SOC Lead',
  SOC_ANALYST_L1: 'SOC Analyst L1',
  SOC_ANALYST_L2: 'SOC Analyst L2',
  SOC_ANALYST_L3: 'SOC Analyst L3',
  SOC_ANALYST: 'SOC Analyst',
};

export default function Navbar() {
  const { currentUser } = useAuth();
  const location = useLocation();

  if (!currentUser) return null;

  const visibleLinks = navLinks.filter(link => !link.roles || link.roles.includes(currentUser.role));
  const roleLabel = ROLE_LABELS[currentUser.role] ?? currentUser.role;

  return (
    <nav className="enterprise-nav sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-5 sm:px-7 flex items-center h-16 gap-7">
        <Link to="/dashboard" className="flex items-center gap-3 shrink-0">
          <span className="w-2 h-2 bg-red-500 rounded-[2px] shadow-[0_0_16px_rgba(239,68,68,0.45)]" />
          <div>
            <div className="text-[17px] font-semibold tracking-[0.16em] text-white leading-none">SIRTS</div>
            <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-600 mt-1.5">Security operations</div>
          </div>
        </Link>

        <div className="h-6 w-px bg-white/[0.08] shrink-0" />

        <div className="flex items-center gap-1 flex-1 overflow-x-auto no-scrollbar">
          {visibleLinks.map(link => {
            const active = location.pathname === link.to ||
              (link.to !== '/dashboard' && link.to !== '/incidents/new' && location.pathname.startsWith(link.to));

            return (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3 py-2 rounded-md text-[13px] font-medium transition-colors whitespace-nowrap ${active ? 'nav-link-active' : 'nav-link-idle'}`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden md:flex items-center gap-4 shrink-0">
          <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-600 border border-white/[0.08] rounded-md px-2.5 py-1.5">
            Preview
          </span>
          <div className="text-right">
            <p className="text-[13px] font-medium text-zinc-200 leading-none">{currentUser.name}</p>
            <p className="text-[10px] text-zinc-600 uppercase tracking-[0.12em] mt-1.5">{roleLabel}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-zinc-900 border border-white/[0.09] flex items-center justify-center">
            <span className="text-xs font-semibold text-zinc-300">{currentUser.name?.charAt(0)?.toUpperCase()}</span>
          </div>
        </div>
      </div>
    </nav>
  );
}
