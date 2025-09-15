import { NextResponse } from 'next/server';

import { createSupabaseServer } from '@/libs/supabase-server';

export async function GET() {
  try {
    const supabase = createSupabaseServer();
    const { data: { session }, error } = await supabase.auth.getSession();

    return NextResponse.json({
      hasSession: !!session,
      error: error?.message || null,
    });
  } catch {
    return NextResponse.json({
      hasSession: false,
      error: 'Server error',
    });
  }
}
