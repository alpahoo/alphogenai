import { createBrowserClient } from '@supabase/ssr';

import { ENV } from './Env';

export function createSupabaseBrowser() {
  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase configuration for browser client');
  }
  return createBrowserClient(
    ENV.SUPABASE_URL,
    ENV.SUPABASE_ANON_KEY,
  );
}
