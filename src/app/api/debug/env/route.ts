import { NextResponse } from 'next/server';

import { ENV_CLIENT, ENV_SERVER } from '@/libs/Env';

export async function GET() {
  return NextResponse.json({
    NEXT_PUBLIC_SUPABASE_URL: !!ENV_CLIENT.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!ENV_CLIENT.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!ENV_SERVER.SUPABASE_SERVICE_ROLE_KEY,
    WEBHOOK_SECRET: !!ENV_SERVER.WEBHOOK_SECRET,
  });
}
