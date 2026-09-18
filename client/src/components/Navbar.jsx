import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { NAV_ITEMS, ROLE_LABELS, canAccessNavItem } from '../lib/rbac.js';

export default function Navbar() {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!currentUser) return null;

  const visibleLinks = NAV_ITEMS.filter(item => canAccessNavItem(currentUser.role, item));

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <nav className="enterprise-nav sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 flex items-center h-16 gap-6">
        <Link to="/dashboard" className="flex items-center gap-3 shrink-0">
          <span className="sirts-mark" />
          <div className="leading-none">
            <div className="text-[17px] font-semibold tracking-[0.18em] text-white">SIRTS</div>
            <div className="text-[9px] uppercase tracking-[0.17em] text-zinc-600 mt-1.5">Security operations</div>
          </div>
        </Link>

        <div className="h-6 w-px bg-white/[0.07] shrink-0" />

        <div className="flex items-center gap-1 flex-1 overflow-x-auto no-scrollbar">
          {visibleLinks.map(item => {
            const active = item.to === '/incidents'
              ? location.pathname === '/incidents' || (
                  location.pathname.startsWith('/incidents/') &&
                  location.pathname !== '/incidents/new'
                )
              : location.pathname === item.to || (
                  item.to !== '/dashboard' &&
                  location.pathname.startsWith(`${item.to}/`)
                );

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`px-3 py-2 rounded-md text-[13px] font-medium whitespace-nowrap transition-all ${active ? 'nav-link-active' : 'nav-link-idle'}`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden md:block text-right">
            <p className="text-[13px] font-medium text-zinc-200 leading-none">{currentUser.name}</p>
            <p className="text-[10px] text-zinc-600 uppercase tracking-[0.12em] mt-1.5">
              {ROLE_LABELS[currentUser.role] ?? currentUser.role}
            </p>
          </div>
          <div className="w-8 h-8 rounded-full bg-zinc-900 border border-white/[0.09] flex items-center justify-center">
            <span className="text-xs font-semibold text-zinc-300">{currentUser.name?.charAt(0)?.toUpperCase()}</span>
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
    </nav>
  );
}
