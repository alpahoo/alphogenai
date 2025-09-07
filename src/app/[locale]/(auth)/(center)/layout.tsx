'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { supabase } from '@/libs/supabase';

export default function CenteredLayout(props: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        router.push('/dashboard');
      } else {
        setLoading(false);
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => {
        if (session?.user) {
          router.push('/dashboard');
        } else {
          setLoading(false);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      {props.children}
    </div>
  );
}
