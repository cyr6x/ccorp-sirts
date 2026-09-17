import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch the public.users row joined with roles for a given auth user id
  const fetchProfile = async (authUser) => {
    const { data, error } = await supabase
      .from('users')
      .select('*, role:roles(id, name, permissions)')
      .eq('id', authUser.id)
      .single();
    if (error || !data) return null;
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role?.name ?? 'SOC_ANALYST',
      permissions: data.role?.permissions ?? {},
      role_id: data.role_id,
    };
  };

  useEffect(() => {
    // 1. Restore existing session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        const profile = await fetchProfile(session.user);
        setCurrentUser(profile);
      }
      setLoading(false);
    });

    // 2. Subscribe to auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user) {
          const profile = await fetchProfile(session.user);
          setCurrentUser(profile);
        } else {
          setCurrentUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return data;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, session, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

