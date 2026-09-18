import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const AuthContext = createContext(null);

const PREVIEW_ACCOUNT = {
  email: 'alice@ccorp.local',
  password: 'Demo@1234',
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  const fetchProfile = async (authUser) => {
    const { data, error } = await supabase
      .from('users')
      .select('*, role:roles(id, name, permissions)')
      .eq('id', authUser.id)
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role?.name ?? 'SOC_ANALYST_L3',
      permissions: data.role?.permissions ?? {},
      role_id: data.role_id,
    };
  };

  const hydrateSession = async (nextSession) => {
    setSession(nextSession);
    if (!nextSession?.user) {
      setCurrentUser(null);
      return;
    }

    const profile = await fetchProfile(nextSession.user);
    setCurrentUser(profile);
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        setAuthError('');
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        let nextSession = sessionData.session;

        if (!nextSession) {
          const { data, error } = await supabase.auth.signInWithPassword(PREVIEW_ACCOUNT);
          if (error) throw error;
          nextSession = data.session;
        }

        if (mounted) await hydrateSession(nextSession);
      } catch (error) {
        if (mounted) {
          setAuthError(error.message || 'Unable to establish preview session.');
          setCurrentUser(null);
          setSession(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    bootstrap();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, nextSession) => {
        if (!mounted || !nextSession?.user) return;
        try {
          await hydrateSession(nextSession);
          setAuthError('');
        } catch (error) {
          setAuthError(error.message || 'Unable to load preview profile.');
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, session, loading, authError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
