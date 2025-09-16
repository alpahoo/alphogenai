import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { ENV_SERVER } from '@/lib/env-server';
import { createRunpodJob } from '@/lib/runpod';
import { createSupabaseServer } from '@/libs/supabase-server';

export async function GET() {
  try {
    const supabase = createSupabaseServer();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching jobs:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ jobs });
  } catch (err) {
    console.error('Error in GET /api/jobs:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServer();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 },
      );
    }

    const { data: job, error } = await supabase
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
      console.error('Error creating job:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (ENV_SERVER.RUNPOD_API_KEY && ENV_SERVER.RUNPOD_ENDPOINT_ID) {
      try {
        const runpodData = await createRunpodJob(prompt, job.id);

        if (runpodData?.id) {
          const { error: updateError } = await supabase
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
      } catch (runpodError) {
        console.error('Runpod integration error:', runpodError);
      }
    }

    return NextResponse.json(
      {
        id: job.id,
        status: job.status,
        progress: job.progress,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('Error in POST /api/jobs:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
