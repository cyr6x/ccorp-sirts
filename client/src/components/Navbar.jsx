import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { abbreviatedName } from '../lib/formatters.js';

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
  SOC_LEAD: 'text-red-300',
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    const close = event => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  if (!currentUser) return null;
  const visibleLinks = navLinks.filter(link => !link.roles || link.roles.includes(currentUser.role));
  const handleLogout = async () => {
    try { await logout(); navigate('/login'); }
    catch { setError('Sign out failed. Please retry.'); }
  };
  return (
    <nav className="enterprise-nav sticky top-0 z-50" aria-label="Main navigation">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 flex flex-wrap items-center min-h-[68px] gap-3 py-3">
        <button className="w-10 h-10 rounded-lg border border-white/10 text-gray-200" aria-label="Toggle navigation"
          aria-expanded={open} aria-controls="main-menu" onClick={() => setOpen(value => !value)}>
          <svg className="w-5 h-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <Link to="/dashboard" className="font-semibold text-white shrink-0">CCorp <span className="text-red-400">SIRTS</span></Link>
        <form role="search" className="order-last sm:order-none w-full sm:w-auto sm:flex-1 sm:max-w-md sm:mx-auto flex gap-2"
          onSubmit={event => { event.preventDefault(); navigate(`/incidents?q=${encodeURIComponent(query.trim())}`); }}>
          <input className="input w-full" aria-label="Quick search incidents" placeholder="Search incidents, assets or IPs…" value={query} onChange={event => setQuery(event.target.value)} />
          <button className="btn-primary" type="submit">Search</button>
        </form>
        <div className="hidden lg:block text-right"><p className="text-sm text-gray-200">{abbreviatedName(currentUser.name)}</p>
          <p className="text-xs text-gray-500">{ROLE_LABELS[currentUser.role]}</p></div>
        <button onClick={handleLogout} className="ml-auto sm:ml-0 text-sm text-gray-300 hover:text-white">Sign out</button>
      </div>
      {error && <p role="alert" className="px-6 pb-3 text-red-300 text-sm">{error}</p>}
      {open && <div id="main-menu" className="border-t border-white/10 bg-gray-950 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {visibleLinks.map(link => {
          const active = location.pathname === link.to ||
            (link.to === '/incidents' && location.pathname.startsWith('/incidents/') && location.pathname !== '/incidents/new') ||
            (link.to === '/knowledge-base' && location.pathname.startsWith('/knowledge-base/'));
          return <Link key={link.to} to={link.to} aria-current={active ? 'page' : undefined}
            className={`px-3 py-3 rounded-lg text-sm ${active ? 'nav-link-active' : 'nav-link-idle'}`}>{link.label}</Link>;
        })}
      </div>}
    </nav>
  );
}
