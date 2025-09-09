'use client';

import { createBrowserClient } from '@supabase/ssr';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { Env } from '@/libs/Env';

const AuthContext = createContext<{
  user: any;
  loading: boolean;
  signOut: () => Promise<void>;
}>({
      user: null,
      loading: true,
      signOut: async () => {},
    });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => createBrowserClient(
    Env.NEXT_PUBLIC_SUPABASE_URL || '',
    Env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  ), []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  useEffect(() => {
    let mounted = true;

    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (mounted) {
          setUser(user);
          setLoading(false);
        }
      } catch (error) {
        console.error('Get user error:', error);
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
      }
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => {
        if (mounted) {
          setUser(session?.user ?? null);
          setLoading(false);
        }
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const contextValue = useMemo(() => ({
    user,
    loading,
    signOut,
  }), [user, loading]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
