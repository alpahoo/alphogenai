import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { Env } from '@/libs/Env';
import { createSupabaseAdmin } from '@/libs/supabase-server';
import { validateBearerToken } from '@/libs/supabase-auth.server';

export async function GET(request: NextRequest) {
  try {
    const user = await validateBearerToken(
      request.headers.get('authorization'),
    );

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ jobs });
  } catch (err) {
    console.error('Error fetching jobs:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await validateBearerToken(
      request.headers.get('authorization'),
    );

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const { data: job, error } = await createSupabaseAdmin()
      .from('jobs')
      .insert({
        user_id: user.id,
        prompt,
        status: 'queued',
        progress: 0,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (Env.RUNPOD_API_KEY && Env.RUNPOD_ENDPOINT_ID) {
      try {
        const webhookUrl = Env.NEXT_PUBLIC_BASE_URL
          ? `${Env.NEXT_PUBLIC_BASE_URL}/api/webhooks/runpod`
          : undefined;

        const runpodResponse = await fetch(`https://api.runpod.ai/v2/${Env.RUNPOD_ENDPOINT_ID}/run`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Env.RUNPOD_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: {
              prompt,
              job_id: job.id,
            },
            ...(webhookUrl && { webhook: webhookUrl }),
          }),
        });

        if (runpodResponse.ok) {
          const runpodData = await runpodResponse.json();

          const { error: updateError } = await createSupabaseAdmin()
            .from('jobs')
            .update({
              status: 'running',
              runpod_job_id: runpodData.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          if (!updateError) {
            job.status = 'running';
            job.runpod_job_id = runpodData.id;
          }
        }
      } catch {
      }
    }

    return NextResponse.json({ job }, { status: 201 });
  } catch (err) {
    console.error('Error creating job:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
