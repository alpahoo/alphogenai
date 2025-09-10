import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { createSupabaseAdmin, validateBearerToken } from '@/libs/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { data: { user }, error: authError } = await validateBearerToken(
      request.headers.get('authorization'),
    );

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    const supabase = createSupabaseAdmin();
    const { data: job, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ job });
  } catch (err) {
    console.error('Error fetching job:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
