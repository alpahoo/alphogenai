'use client';

import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

import { ENV } from '@/libs/Env';
import { createSupabaseBrowser } from '@/libs/supabase';

export const AuthContext = createContext<{
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

  const supabase = useMemo(() => {
    if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
      console.error('AuthContext: Missing Supabase configuration');
      return null;
    }
    return createSupabaseBrowser();
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) {
      console.error('AuthContext: Cannot sign out, Supabase client not available');
      return;
    }
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }, [supabase]);

  useEffect(() => {
    let mounted = true;

    if (!supabase) {
      console.error('AuthContext: Supabase client not available');
      if (mounted) {
        setUser(null);
        setLoading(false);
      }
      return;
    }

    const getUser = async () => {
      try {
        console.log('AuthContext: Getting user...'); // eslint-disable-line no-console
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          console.error('AuthContext: Get user error:', error);
          console.error('AuthContext: Supabase URL:', ENV.SUPABASE_URL ? 'SET' : 'NOT SET');
          console.error('AuthContext: Supabase Anon Key:', ENV.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        console.log('AuthContext: User retrieved:', user ? 'authenticated' : 'not authenticated'); // eslint-disable-line no-console
        if (mounted) {
          setUser(user);
          setLoading(false);
        }
      } catch (error) {
        console.error('AuthContext: Get user exception:', error);
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
      }
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('AuthContext: Auth state change:', event, session ? 'session exists' : 'no session'); // eslint-disable-line no-console
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
  }), [user, loading, signOut]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
