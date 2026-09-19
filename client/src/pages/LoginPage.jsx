import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login, authError } = useAuth();
  const navigate  = useNavigate();
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);

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

  return (
    <main className="login-shell">
      <div className="login-layout">
        <section className="login-hero">
          <div className="signal-label mb-5">
            <span className="signal-dot" />
            Security operations platform
          </div>
          <div className="login-hero-rule mb-7" />
          <h1 className="login-hero-title text-white">
            Detect.<br />
            Respond.<br />
            <span className="text-red-500">Stay ahead.</span>
          </h1>
          <p className="mt-7 max-w-xl text-base sm:text-lg leading-relaxed text-gray-400">
            CCorp SIRTS unifies incident triage, response workflows, asset context,
            knowledge and audit evidence in one live SOC workspace.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3 max-w-lg">
            {[
              ['LIVE', 'Incident feed'],
              ['RBAC', 'Controlled access'],
              ['AUDIT', 'Evidence trail'],
            ].map(([eyebrow, label]) => (
              <div key={eyebrow} className="border-l border-red-500/40 pl-3 py-1">
                <p className="text-[10px] tracking-[0.2em] text-red-400 font-semibold">{eyebrow}</p>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="w-full max-w-md justify-self-end">
          <div className="login-card p-7 sm:p-8">
            <div className="flex items-start justify-between gap-5 mb-8">
              <div>
                <p className="signal-label mb-2"><span className="signal-dot" />Secure access</p>
                <h2 className="text-2xl font-semibold tracking-tight text-white">CCorp SIRTS</h2>
                <p className="text-sm text-gray-500 mt-1">Security Incident Response &amp; Ticketing System</p>
              </div>
              <div className="enterprise-brandmark w-11 h-11 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v5c0 4.6-2.8 8.7-7 10-4.2-1.3-7-5.4-7-10V6l7-3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 12.2l2.2 2.2 4.8-5" />
                </svg>
              </div>
            </div>

            {(error || authError) && (
              <div className="mb-5 p-3.5 bg-red-950/50 border border-red-800/60 rounded-lg text-red-200 text-sm">
                {error || authError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="login-email" className="block text-xs uppercase tracking-[0.14em] font-semibold text-gray-500 mb-2">Email</label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@ccorp.local"
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="login-password" className="block text-xs uppercase tracking-[0.14em] font-semibold text-gray-500 mb-2">Password</label>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="input"
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Authenticating...
                  </span>
                ) : 'Enter SOC Workspace'}
              </button>
            </form>

            <div className="mt-6 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-gray-700">
              <span>Authorised personnel only</span>
              <span className="text-red-900">Protected</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
