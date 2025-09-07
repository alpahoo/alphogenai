import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

import { Env } from './Env';

export const supabase = createClient(
  Env.NEXT_PUBLIC_SUPABASE_URL || '',
  Env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

export const createServerSupabaseClient = () => {
  const { cookies } = require('next/headers');
  const cookieStore = cookies();

  return createServerClient(
    Env.NEXT_PUBLIC_SUPABASE_URL || '',
    Env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    },
  );
};

export const supabaseAdmin = createClient(
  Env.NEXT_PUBLIC_SUPABASE_URL || '',
  Env.SUPABASE_SERVICE_ROLE || '',
);
