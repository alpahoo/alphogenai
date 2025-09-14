import { createSupabaseBrowser } from './supabase-browser';
import { createSupabaseAdmin, createSupabaseServer } from './supabase-server';

export { createSupabaseAdmin, createSupabaseBrowser, createSupabaseServer };

export async function validateBearerToken(authHeader: string | null) {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const supabase = createSupabaseAdmin();

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    return error ? null : user;
  } catch {
    return null;
  }
}
