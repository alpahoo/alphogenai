import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { ENV_SERVER } from '@/libs/Env';
import { R2Client } from '@/libs/r2-client';
import { createSupabaseAdmin } from '@/libs/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = request.headers.get('x-webhook-secret');

    if (ENV_SERVER.WEBHOOK_SECRET && webhookSecret !== ENV_SERVER.WEBHOOK_SECRET) {
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
      try {
        const response = await fetch(output.result_url);
        if (!response.ok) {
          throw new Error('Failed to download result');
        }

        const buffer = await response.arrayBuffer();
        const r2Client = new R2Client();
        const key = `results/${runpodJobId}-${Date.now()}.mp4`;
        await r2Client.uploadFile(key, new Uint8Array(buffer), 'video/mp4');

        updateData.status = 'done';
        updateData.progress = 100;
        updateData.result_key = key;
      } catch (error) {
        console.error('R2 upload failed:', error);
        updateData.status = 'error';
        updateData.error_message = 'Failed to upload result to storage';
      }
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
      console.error('jobs.update.from_webhook.error', error);
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, job: data });
  } catch (error) {
    console.error('runpod.webhook.error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
