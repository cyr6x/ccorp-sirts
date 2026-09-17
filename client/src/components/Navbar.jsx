import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navLinks = [
  { to: '/dashboard',      label: 'Dashboard',    roles: null,                 icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { to: '/incidents',      label: 'Incidents',    roles: null,                 icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
  { to: '/incidents/new',  label: 'New Incident', roles: null,                 icon: 'M12 4v16m8-8H4' },
  { to: '/knowledge-base', label: 'Knowledge Base',roles: null,                icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { to: '/assets',         label: 'Assets',       roles: null,                 icon: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18' },
  { to: '/reports',        label: 'Reports',      roles: ['ADMIN','SOC_LEAD'], icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { to: '/audit-logs',     label: 'Audit Logs',   roles: ['ADMIN','SOC_LEAD'], icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { to: '/users',          label: 'Users',        roles: ['ADMIN'],            icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
];

const ROLE_COLORS = { ADMIN:'text-red-400', SOC_LEAD:'text-orange-400', SOC_ANALYST:'text-blue-400' };
const ROLE_LABELS = { ADMIN:'Administrator', SOC_LEAD:'SOC Lead', SOC_ANALYST:'SOC Analyst' };


export default function Navbar() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => { await logout(); navigate('/login'); };
  if (!currentUser) return null;

  const visibleLinks = navLinks.filter(l => !l.roles || l.roles.includes(currentUser.role));
  const roleColor = ROLE_COLORS[currentUser.role] ?? 'text-blue-400';
  const roleLabel = ROLE_LABELS[currentUser.role] ?? currentUser.role;

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 flex items-center h-16 gap-6">
        <Link to="/dashboard" className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <span className="font-bold text-white text-sm tracking-wide">CCorp</span>
            <span className="ml-1 font-bold text-blue-400 text-sm">SIRTS</span>
          </div>
        </Link>
        <div className="h-6 w-px bg-gray-700" />
        <div className="flex items-center gap-1 flex-1 overflow-x-auto">
          {visibleLinks.map(link => {
            const active = location.pathname === link.to ||
              (link.to !== '/dashboard' && link.to !== '/incidents/new' && location.pathname.startsWith(link.to));
            return (
              <Link key={link.to} to={link.to}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 whitespace-nowrap ${active ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30' : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'}`}>
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={link.icon} />
                </svg>
                {link.label}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-gray-800 rounded-full border border-gray-700">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-gray-400 font-medium">LIVE</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-600/30 flex items-center justify-center">
              <span className="text-xs font-bold text-blue-400">{currentUser.name?.charAt(0)?.toUpperCase()}</span>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-gray-100 leading-none">{currentUser.name}</p>
              <p className={`text-xs leading-none mt-0.5 ${roleColor}`}>{roleLabel}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition-all border border-transparent hover:border-gray-700">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
}


