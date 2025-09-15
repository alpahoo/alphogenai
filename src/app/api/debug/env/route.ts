import { NextResponse } from 'next/server';

import { ENV_CLIENT, ENV_SERVER } from '@/libs/Env';

export async function GET() {
  try {
    const envStatus = {
      NEXT_PUBLIC_SUPABASE_URL: !!ENV_CLIENT.SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!ENV_CLIENT.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!ENV_SERVER.SUPABASE_SERVICE_ROLE_KEY,
      WEBHOOK_SECRET: !!ENV_SERVER.WEBHOOK_SECRET,
      RUNPOD_API_KEY: !!ENV_SERVER.RUNPOD_API_KEY,
      RUNPOD_ENDPOINT_ID: !!ENV_SERVER.RUNPOD_ENDPOINT_ID,
    };

    return NextResponse.json(envStatus);
  } catch {
    return NextResponse.json(
      { error: 'Failed to check environment variables' },
      { status: 500 },
    );
  }
}
