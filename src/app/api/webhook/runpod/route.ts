import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/supabase-clients/server';
import { ENV_SERVER } from '@/lib/env-server';

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = request.headers.get('x-webhook-secret');

    if (!webhookSecret || webhookSecret !== ENV_SERVER.WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'Invalid webhook secret' },
        { status: 401 }
      );
    }

    const payload = await request.json();

    const { job_id, status, progress, result } = payload;

    if (!job_id) {
      return NextResponse.json(
        { error: 'Missing job_id in payload' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseClient();

    const updateData: Record<string, string | number> = {
      updated_at: new Date().toISOString(),
    };

    if (status) {
      updateData.status = status;
    }

    if (typeof progress === 'number') {
      updateData.progress = Math.max(0, Math.min(100, progress));
    }

    if (result) {
      updateData.result_key = result;
    }

    const { error } = await supabase
      .from('jobs')
      .update(updateData)
      .eq('id', job_id);

    if (error) {
      console.error('Error updating job:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: 'Job updated successfully',
      job_id,
      updated_fields: Object.keys(updateData),
    });
  } catch (err) {
    console.error('Error in webhook handler:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
