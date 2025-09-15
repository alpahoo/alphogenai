import { createBrowserClient } from '@supabase/ssr';

import { ENV_CLIENT } from './Env';

export function createSupabaseBrowser() {
  if (!ENV_CLIENT.SUPABASE_URL || !ENV_CLIENT.SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase configuration for browser client');
  }
  return createBrowserClient(
    ENV_CLIENT.SUPABASE_URL,
    ENV_CLIENT.SUPABASE_ANON_KEY,
  );
}
