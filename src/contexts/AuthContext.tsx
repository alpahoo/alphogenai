'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/libs/supabase';

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

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      },
    );

    return () => subscription.unsubscribe();
  }, []);

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
