import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { Env } from '@/libs/Env';
import { createSupabaseAdmin } from '@/libs/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = request.headers.get('x-webhook-secret');

    if (Env.WEBHOOK_SECRET && webhookSecret !== Env.WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();

    const { id: runpodJobId, status, output } = payload;

    if (!runpodJobId) {
      return NextResponse.json({ error: 'Missing runpod job ID' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (status === 'COMPLETED' && output?.result_url) {
      updateData.status = 'done';
      updateData.progress = 100;
      updateData.result_r2_key = output.result_url;
    } else if (status === 'FAILED') {
      updateData.status = 'error';
      updateData.error_message = output?.error || 'Job failed on Runpod';
    } else if (status === 'IN_PROGRESS') {
      updateData.status = 'running';
      updateData.progress = output?.progress || 50;
    } else if (status === 'IN_QUEUE') {
      updateData.status = 'running';
      updateData.progress = 0;
    } else {
      return NextResponse.json({ success: true, message: 'Status not handled' });
    }

    const { data, error } = await supabase
      .from('jobs')
      .update(updateData)
      .eq('runpod_job_id', runpodJobId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, job: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
