import { NextResponse } from 'next/server';

import { ENV_CLIENT } from '@/lib/env-client';

export async function GET() {
  return NextResponse.json({
    ok: true,
    env: process.env.NODE_ENV || 'development',
    commit: ENV_CLIENT.COMMIT_SHA || 'unknown',
    timestamp: new Date().toISOString(),
  });
}
