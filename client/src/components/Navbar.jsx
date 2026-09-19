import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { NAV_ITEMS, ROLE_LABELS, canAccessNavItem } from '../lib/rbac.js';
import { formatPersonName, initialsFor } from '../lib/userDisplay.js';

const SEARCH_ALIASES = {
  '/dashboard': ['home', 'overview', 'dashboard'],
  '/incidents': ['incident', 'incidents', 'queue', 'registry'],
  '/incidents/new': ['create incident', 'new incident', 'report incident'],
  '/knowledge-base': ['knowledge', 'kb', 'playbook', 'article'],
  '/assets': ['asset', 'assets', 'inventory'],
  '/reports': ['report', 'reports', 'analytics'],
  '/audit-logs': ['audit', 'audit log', 'logs'],
  '/users': ['users', 'staff', 'access', 'roles'],
};

const PATH_LABELS = {
  dashboard: 'Overview',
  incidents: 'Incidents',
  new: 'Create',
  'knowledge-base': 'Knowledge',
  assets: 'Assets',
  reports: 'Reports',
  'audit-logs': 'Audit',
  users: 'Users',
};

export default function Navbar() {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');

  const visibleLinks = useMemo(
    () => currentUser ? NAV_ITEMS.filter(item => canAccessNavItem(currentUser.role, item)) : [],
    [currentUser]
  );

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return visibleLinks.filter(item => {
      const terms = [item.label, ...(SEARCH_ALIASES[item.to] || [])];
      return terms.some(term => term.toLowerCase().includes(needle));
    }).slice(0, 5);
  }, [query, visibleLinks]);

  const breadcrumbParts = location.pathname
    .split('/')
    .filter(Boolean)
    .map((segment, index, segments) => {
      const path = `/${segments.slice(0, index + 1).join('/')}`;
      return {
        label: PATH_LABELS[segment] || (index === segments.length - 1 ? 'Detail' : segment),
        path,
      };
    });

  useEffect(() => {
    setMenuOpen(false);
    setQuery('');
  }, [location.pathname]);

  useEffect(() => {
    const onKeyDown = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setQuery('');
        searchRef.current?.blur();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const go = path => {
    navigate(path);
    setQuery('');
  };

  const submitSearch = event => {
    event.preventDefault();
    if (matches[0]) go(matches[0].to);
  };

  if (!currentUser) return null;

  return (
    <>
      <nav className="enterprise-nav sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6">
          <div className="h-16 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="icon-button"
                onClick={() => setMenuOpen(value => !value)}
                aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={menuOpen}
              >
                <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>

              <Link to="/dashboard" className="flex items-center gap-3 shrink-0" aria-label="SIRTS home">
                <span className="sirts-mark" />
                <div className="leading-none">
                  <div className="text-[16px] font-semibold tracking-[0.18em] text-white">SIRTS</div>
                  <div className="hidden sm:block text-[8px] uppercase tracking-[0.17em] text-zinc-600 mt-1.5">
                    Security operations
                  </div>
                </div>
              </Link>
            </div>

            <div className="flex justify-center min-w-0">
              <form onSubmit={submitSearch} className="relative w-full max-w-xl">
                <div className="global-search">
                  <svg className="w-4 h-4 text-zinc-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="11" cy="11" r="6.5" />
                    <path strokeLinecap="round" d="m16 16 4 4" />
                  </svg>
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder="Search SIRTS or jump to a workspace…"
                    className="global-search-input"
                    aria-label="Quick navigation search"
                  />
                  <span className="hidden sm:inline text-[10px] text-zinc-700 border border-white/[0.07] rounded px-1.5 py-0.5">
                    Ctrl K
                  </span>
                </div>

                {query && (
                  <div className="global-search-results">
                    {matches.length > 0 ? matches.map(item => (
                      <button
                        key={item.to}
                        type="button"
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => go(item.to)}
                        className="global-search-result"
                      >
                        <span>{item.label}</span>
                        <span className="text-[10px] text-zinc-700">{item.to}</span>
                      </button>
                    )) : (
                      <div className="px-3 py-3 text-xs text-zinc-600">No matching workspace.</div>
                    )}
                  </div>
                )}
              </form>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden md:block text-right max-w-[180px]">
                <p className="text-[13px] font-medium text-zinc-200 leading-none truncate" title={currentUser.name}>
                  {formatPersonName(currentUser.name)}
                </p>
                <p className="text-[9px] text-zinc-600 uppercase tracking-[0.12em] mt-1.5 truncate">
                  {ROLE_LABELS[currentUser.role] ?? currentUser.role}
                </p>
              </div>

              <div className="w-8 h-8 rounded-full bg-zinc-900 border border-white/[0.09] flex items-center justify-center" title={currentUser.name}>
                <span className="text-[11px] font-semibold text-zinc-300">{initialsFor(currentUser.name)}</span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="icon-button"
                aria-label="Sign out"
                title="Sign out"
              >
                <svg className="w-[17px] h-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>

          <div className="h-8 flex items-center gap-1.5 border-t border-white/[0.045] text-[11px] text-zinc-600">
            <Link to="/dashboard" className="hover:text-zinc-300 transition-colors">Home</Link>
            {breadcrumbParts.map((part, index) => (
              <span key={`${part.path}-${index}`} className="flex items-center gap-1.5">
                <span className="text-zinc-800">/</span>
                {index < breadcrumbParts.length - 1 ? (
                  <Link to={part.path} className="hover:text-zinc-300 transition-colors">{part.label}</Link>
                ) : (
                  <span className="text-zinc-400">{part.label}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-[60]" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation menu"
          />
          <aside className="nav-drawer" aria-label="Primary navigation">
            <div className="flex items-center justify-between px-5 h-16 border-b border-white/[0.07]">
              <Link to="/dashboard" className="flex items-center gap-3">
                <span className="sirts-mark" />
                <span className="text-sm font-semibold tracking-[0.18em] text-white">SIRTS</span>
              </Link>
              <button type="button" className="icon-button" onClick={() => setMenuOpen(false)} aria-label="Close navigation menu">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div className="p-3 space-y-1">
              {visibleLinks.map(item => {
                const active = location.pathname === item.to ||
                  (item.to !== '/dashboard' && item.to !== '/incidents/new' && location.pathname.startsWith(item.to));

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`drawer-link ${active ? 'drawer-link-active' : ''}`}
                  >
                    <span>{item.label}</span>
                    <span className="text-[10px] text-zinc-700">{item.to}</span>
                  </Link>
                );
              })}
            </div>

            <div className="absolute bottom-0 inset-x-0 p-4 border-t border-white/[0.07]">
              <p className="text-xs text-zinc-300">{formatPersonName(currentUser.name)}</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-600 mt-1">
                {ROLE_LABELS[currentUser.role] ?? currentUser.role}
              </p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
