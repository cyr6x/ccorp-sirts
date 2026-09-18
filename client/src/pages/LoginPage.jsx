import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (_error) {
      setError('Unable to sign in. Check your staff email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="login-card">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-7">
            <span className="sirts-mark" />
            <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Secure workspace</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-[0.16em] text-white">SIRTS</h1>
          <p className="text-sm text-zinc-500 mt-3">
            Security Incident Response &amp; Ticketing System
          </p>
        </header>

        {error && (
          <div role="alert" className="mb-5 rounded-lg border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="field-label">Staff email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              autoComplete="username"
              required
              placeholder="name@ccorp.local"
              className="input"
            />
          </div>

          <div>
            <label htmlFor="password" className="field-label">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="input"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Authenticating...
              </span>
            ) : 'Sign in'}
          </button>
        </form>

        <footer className="mt-7 pt-5 border-t border-white/[0.06] flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-zinc-700">
          <span>Authorised personnel</span>
          <span className="flex items-center gap-2"><span className="status-live-dot" /> Protected</span>
        </footer>
      </section>
    </main>
  );
}
