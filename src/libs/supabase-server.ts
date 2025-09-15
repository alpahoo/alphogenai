import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { ENV_CLIENT, ENV_SERVER } from './Env';

export function createSupabaseServer() {
  const cookieStore = cookies();

  if (!ENV_CLIENT.SUPABASE_URL || !ENV_CLIENT.SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase configuration for server client');
  }

  return createServerClient(
    ENV_CLIENT.SUPABASE_URL,
    ENV_CLIENT.SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
          }
        },
      },
    },
  );
}

export function createSupabaseAdmin() {
  if (!ENV_CLIENT.SUPABASE_URL || !ENV_SERVER.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase configuration for admin client');
  }

  return createServerClient(
    ENV_CLIENT.SUPABASE_URL,
    ENV_SERVER.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    },
  );
}
