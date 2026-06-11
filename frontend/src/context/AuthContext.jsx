import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('role, avatar_url')
        .eq('id', userId)
        .single();
      setProfile(data ?? null);
      return data;
    } catch {
      // profiles table may not exist yet — degrade gracefully
      setProfile(null);
      return null;
    }
  }, []);

  const hydrateUser = useCallback(async (supabaseUser) => {
    if (!supabaseUser) {
      setUser(null);
      setProfile(null);
      return;
    }
    setUser(supabaseUser);
    const profileData = await fetchProfile(supabaseUser.id);
    // Mirror to localStorage for pages that still read it directly
    localStorage.setItem('user', JSON.stringify({
      id: supabaseUser.id,
      email: supabaseUser.email,
      name: supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name || 'Student',
      created_at: supabaseUser.created_at,
      user_metadata: supabaseUser.user_metadata,
      avatar_url: profileData?.avatar_url ?? null,
    }));
  }, [fetchProfile]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      hydrateUser(session?.user ?? null).finally(() => setLoading(false));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrateUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [hydrateUser]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    setUser(null);
    setProfile(null);
  }, []);

  // Role is stored in user_metadata (authoritative) with profiles table as fallback
  const isAdmin =
    user?.user_metadata?.role === 'admin' ||
    profile?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, loading, signOut, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
