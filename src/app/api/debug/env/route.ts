import { NextResponse } from 'next/server';

import { ENV } from '@/libs/Env';

export async function GET() {
  try {
    const envCheck = {
      NEXT_PUBLIC_SUPABASE_URL: !!ENV.SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!ENV.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!ENV.SUPABASE_SERVICE_ROLE_KEY,
      WEBHOOK_SECRET: !!ENV.WEBHOOK_SECRET,
      NODE_ENV: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(envCheck);
  } catch {
    return NextResponse.json({ error: 'Failed to check environment' }, { status: 500 });
  }
}
