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
        <section className="w-full max-w-md">
          <div className="login-card p-7 sm:p-8">
            <div className="mb-8">
              <p className="signal-label mb-2"><span className="signal-dot" />Secure access</p>
              <h1 className="text-2xl font-semibold tracking-tight text-white">CCorp SIRTS</h1>
              <p className="text-sm text-gray-500 mt-1">Security Incident Response &amp; Ticketing System</p>
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
