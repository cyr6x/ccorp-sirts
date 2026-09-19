import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, configurationError } from '../lib/supabaseClient.js';

const AuthContext = createContext(null);
const ROLES = ['ADMIN', 'SOC_LEAD', 'SOC_ANALYST_L1', 'SOC_ANALYST_L2', 'SOC_ANALYST_L3'];

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [session, setSession] = useState(undefined);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    let receivedEvent = false;
    // Keep the callback synchronous: profile queries here can deadlock Auth.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      receivedEvent = true;
      if (!alive) return;
      setLoading(Boolean(next));
      if (!next) setCurrentUser(null);
      setSession(next ? { ...next } : null);
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive || receivedEvent) return;
      if (error) throw error;
      setSession(data.session);
    }).catch(error => {
      if (alive) { setAuthError(error.message); setSession(null); setLoading(false); }
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!supabase || session === undefined) return;
    if (!session) { setCurrentUser(null); setLoading(false); return; }
    const controller = new AbortController();
    let alive = true;
    setLoading(true);
    const timeout = setTimeout(() => controller.abort(), 15000);
    supabase.from('users').select('id, name, email, role_id, role:roles(id, name, permissions)')
      .eq('id', session.user.id).single().abortSignal(controller.signal)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) throw new Error('Unable to load your staff profile. Please retry or contact your administrator.');
        if (!data?.role || !ROLES.includes(data.role.name)) throw new Error('Your account does not have an active SIRTS role. Contact your administrator.');
        setCurrentUser({ ...data, role: data.role.name, permissions: data.role.permissions });
        setAuthError('');
      }).catch(error => {
        if (alive) { setCurrentUser(null); setAuthError(error.message); }
      }).finally(() => {
        clearTimeout(timeout);
        if (alive) setLoading(false);
      });
    return () => { alive = false; clearTimeout(timeout); controller.abort(); };
  }, [session]);

  const login = async (email, password) => {
    if (!supabase) throw new Error(configurationError);
    setAuthError('');
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(error.message);
    return data;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) { setAuthError(error.message); throw error; }
    setCurrentUser(null);
    setSession(null);
  };

  return <AuthContext.Provider value={{ currentUser, session, login, logout, loading, authError }}>
    {children}
  </AuthContext.Provider>;
};
export const useAuth = () => useContext(AuthContext);
