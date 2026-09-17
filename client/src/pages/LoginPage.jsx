import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const DEMO_ACCOUNTS = [
  { name:'Alice Chen',  email:'alice@ccorp.local',  password:'Demo@1234', tier:'Administrator',    color:'text-red-400',    bg:'bg-red-500/10 border-red-700/40'    },
  { name:'Ben Torres',  email:'ben@ccorp.local',    password:'Demo@1234', tier:'SOC Lead',         color:'text-orange-400', bg:'bg-orange-500/10 border-orange-700/40' },
  { name:'Chloe Park',  email:'chloe@ccorp.local',  password:'Demo@1234', tier:'SOC Analyst — L1', color:'text-blue-400',   bg:'bg-blue-500/10 border-blue-700/40'   },
  { name:'Darius Webb', email:'darius@ccorp.local', password:'Demo@1234', tier:'SOC Analyst — L2', color:'text-cyan-400',   bg:'bg-cyan-500/10 border-cyan-700/40'   },
  { name:'Eva Singh',   email:'eva@ccorp.local',    password:'Demo@1234', tier:'SOC Analyst — L3', color:'text-violet-400', bg:'bg-violet-500/10 border-violet-700/40' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [showDemo,    setShowDemo]    = useState(false);
  const [filledEmail, setFilledEmail] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (acc) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setFilledEmail(acc.email);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-4">

        {/* ── Main login card ───────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 shadow-2xl">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 mb-4">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">CCorp SIRTS</h1>
            <p className="text-gray-400 text-sm mt-1">Security Incident Response &amp; Ticketing System</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFilledEmail(''); }}
                required
                autoComplete="email"
                placeholder="you@ccorp.local"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="input w-full"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 text-sm font-semibold"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="text-xs text-gray-600 text-center mt-6">
            CCorp Internal System &mdash; Authorised users only
          </p>
        </div>


        {/* ── Demo credentials panel ────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-xl overflow-hidden">
          <button
            onClick={() => setShowDemo(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 transition-colors"
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Demo Accounts
              <span className="text-xs text-gray-600 font-normal hidden sm:inline">— click to auto-fill</span>
            </span>
            <svg className={`w-4 h-4 transition-transform duration-200 ${showDemo ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showDemo && (
            <div className="border-t border-gray-800 divide-y divide-gray-800/60">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillDemo(acc)}
                  className={`w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-gray-800/50 transition-colors group ${filledEmail === acc.email ? 'bg-gray-800/70' : ''}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center border ${acc.bg} shrink-0`}>
                    <span className={`text-xs font-bold ${acc.color}`}>{acc.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 leading-tight">{acc.name}</p>
                    <p className={`text-xs leading-tight mt-0.5 ${acc.color}`}>{acc.tier}</p>
                  </div>
                  <div className="hidden sm:block text-right shrink-0">
                    <p className="text-xs font-mono text-gray-400">{acc.email}</p>
                    <p className="text-xs font-mono text-gray-600">Demo@1234</p>
                  </div>
                  <div className="shrink-0">
                    {filledEmail === acc.email ? (
                      <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
              <div className="px-5 py-2.5 bg-gray-950/60">
                <p className="text-xs text-gray-600">
                  All accounts share password <span className="font-mono text-gray-500">Demo@1234</span>
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

