import { NextResponse } from 'next/server';

import { ENV } from '@/libs/Env';

export async function GET() {
  try {
    const envStatus = {
      NEXT_PUBLIC_SUPABASE_URL: !!ENV.SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!ENV.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!ENV.SUPABASE_SERVICE_ROLE_KEY,
      WEBHOOK_SECRET: !!ENV.WEBHOOK_SECRET,
      RUNPOD_API_KEY: !!ENV.RUNPOD_API_KEY,
      RUNPOD_ENDPOINT_ID: !!ENV.RUNPOD_ENDPOINT_ID,
    };

    return NextResponse.json(envStatus);
  } catch {
    return NextResponse.json(
      { error: 'Failed to check environment variables' },
      { status: 500 },
    );
  }
}
