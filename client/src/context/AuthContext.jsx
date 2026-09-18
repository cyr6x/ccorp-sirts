import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  const fetchProfile = useCallback(async (authUser) => {
    const { data, error } = await supabase
      .from('users')
      .select('*, role:roles(id, name, permissions)')
      .eq('id', authUser.id)
      .single();

    if (error || !data) {
      throw new Error('Your SIRTS staff profile could not be loaded.');
    }

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role?.name ?? data.role_id ?? 'SOC_ANALYST_L3',
      permissions: data.role?.permissions ?? {},
      role_id: data.role_id,
    };
  }, []);

  const hydrateSession = useCallback(async (nextSession) => {
    setSession(nextSession ?? null);
    if (!nextSession?.user) {
      setCurrentUser(null);
      return;
    }

    const profile = await fetchProfile(nextSession.user);
    setCurrentUser(profile);
  }, [fetchProfile]);

  useEffect(() => {
    let active = true;

    const restore = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (active) await hydrateSession(data.session);
      } catch (error) {
        if (active) {
          setAuthError(error.message || 'Unable to restore the secure session.');
          setCurrentUser(null);
          setSession(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    restore();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;

      setSession(nextSession ?? null);
      if (!nextSession?.user) {
        setCurrentUser(null);
        return;
      }

      // Avoid making a second Supabase request synchronously inside the auth callback.
      window.setTimeout(async () => {
        if (!active) return;
        try {
          const profile = await fetchProfile(nextSession.user);
          if (active) {
            setCurrentUser(profile);
            setAuthError('');
          }
        } catch (error) {
          if (active) {
            setCurrentUser(null);
            setAuthError(error.message || 'Unable to load the staff profile.');
          }
        }
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, hydrateSession]);

  const login = async (email, password) => {
    setAuthError('');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error || !data.session?.user) {
      throw new Error('Invalid email or password.');
    }

    const profile = await fetchProfile(data.session.user);
    setSession(data.session);
    setCurrentUser(profile);
    return profile;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      session,
      login,
      logout,
      loading,
      authError,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
