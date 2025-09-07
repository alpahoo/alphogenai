interface Env {
  R2_BUCKET: R2Bucket
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE: string
  RUNPOD_API_KEY: string
  RUNPOD_ENDPOINT_ID: string
  APP_ADMIN_TOKEN: string
  WEBHOOK_SECRET: string
}

interface Job {
  id: string
  user_id: string
  prompt: string
  status: 'queued' | 'running' | 'done' | 'error'
  progress: number
  result_r2_key?: string
  created_at: string
  updated_at: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

interface SupabaseUser {
  id: string
  email: string
  [key: string]: any
}

async function verifySupabaseToken(token: string, env: Env): Promise<{ sub: string } & SupabaseUser | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) {
    console.error('❌ Supabase not configured')
    return null
  }

  try {
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': env.SUPABASE_SERVICE_ROLE
      }
    })

    if (!response.ok) {
      console.error('❌ Supabase token verification failed:', response.status)
      return null
    }

    const user = await response.json() as SupabaseUser
    console.log(`🔍 Supabase user verified - id: ${user.id}`)
    return { sub: user.id, ...user }
  } catch (error) {
    console.error('❌ Supabase token verification error:', error)
    return null
  }
}

function isSupabaseConfigured(env: Env): boolean {
  return !!(env.SUPABASE_URL && 
         env.SUPABASE_SERVICE_ROLE && 
         env.SUPABASE_URL !== 'your_supabase_url' &&
         env.SUPABASE_SERVICE_ROLE !== 'your_supabase_service_role_key')
}

async function supabaseRequest(env: Env, method: string, endpoint: string, data?: any): Promise<any> {
  if (!isSupabaseConfigured(env)) {
    throw new Error('Supabase not configured')
  }

  const url = `${env.SUPABASE_URL}/rest/v1/${endpoint}`
  const headers = {
    'apikey': env.SUPABASE_SERVICE_ROLE,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  }

  console.log(`🔍 Supabase ${method} ${endpoint}`)

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Supabase ${method} ${endpoint} failed:`, response.status, errorText)
      throw new Error(`Supabase request failed: ${response.status} ${errorText}`)
    }

    const result = await response.json()
    console.log(`✅ Supabase ${method} ${endpoint} success`)
    return result
  } catch (error) {
    console.error(`❌ Supabase ${method} ${endpoint} error:`, error)
    throw error
  }
}


async function createJob(userId: string, prompt: string, env: Env): Promise<Job> {
  if (!prompt) {
    throw new Error("Prompt required")
  }

  if (!isSupabaseConfigured(env)) {
    throw new Error("Supabase not configured")
  }

  try {
    console.log(`🔍 Creating job for user_id=${userId}`)
    
    const jobData = {
      user_id: userId,
      prompt: prompt
    }
    
    const created = await supabaseRequest(env, 'POST', 'jobs', jobData)
    
    if (!created || created.length === 0) {
      throw new Error('No job returned from Supabase')
    }
    
    const job = created[0]
    console.log(`✅ Job ${job.id} created successfully`)
    
    await triggerRunpodJob(env, job)
    return job
  } catch (error) {
    console.error('❌ Failed to create job:', error)
    throw error
  }
}

async function getJob(jobId: string, userId: string, env: Env): Promise<Job | null> {
  if (!isSupabaseConfigured(env)) {
    throw new Error("Supabase not configured")
  }

  try {
    console.log(`🔍 Getting job ${jobId} for user_id=${userId}`)
    
    const result = await supabaseRequest(env, 'GET', `jobs?id=eq.${jobId}&user_id=eq.${userId}`)
    
    if (!result || result.length === 0) {
      console.log(`❌ Job not found: ${jobId}`)
      return null
    }
    
    const job = result[0]
    console.log(`✅ Job found: ${job.id}`)
    return job
  } catch (error) {
    console.error('❌ Failed to get job:', error)
    throw error
  }
}

async function updateJob(env: Env, id: string, updates: Partial<Job>): Promise<Job> {
  const updateData = {
    ...updates,
    updated_at: new Date().toISOString(),
  }

  if (isSupabaseConfigured(env)) {
    try {
      const [updated] = await supabaseRequest(env, 'PATCH', `jobs?id=eq.${id}`, updateData)
      return updated
    } catch (error) {
      console.error('Supabase updateJob error:', error)
      throw new Error('Job update failed')
    }
  } else {
    throw new Error('Supabase not configured')
  }
}

async function triggerRunpodJob(env: Env, job: Job): Promise<void> {
  if (!env.RUNPOD_API_KEY || !env.RUNPOD_ENDPOINT_ID) {
    console.log('RunPod not configured, job will remain queued')
    return
  }

  try {
    const response = await fetch(`https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RUNPOD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          job_id: job.id,
          prompt: job.prompt,
          webhook_url: `https://api.alphogen.com/api/webhooks/runpod`,
        },
      }),
    })

    if (response.ok) {
      const result = await response.json()
      await updateJob(env, job.id, {
        status: 'running',
      })
    }
  } catch (error) {
    console.error('Failed to trigger RunPod job:', error)
  }
}

async function handleAuth(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname

  if (path === '/api/auth/signup') {
    if (!isSupabaseConfigured(env)) {
      return new Response(JSON.stringify({ error: 'Authentication not configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    try {
      const body = await request.json() as { email: string; password: string }
      const { email, password } = body
      
      if (!email || !password) {
        return new Response(JSON.stringify({ error: 'Email and password required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const response = await fetch(`${env.SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'apikey': env.SUPABASE_SERVICE_ROLE,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })

      if (!response.ok) {
        const error = await response.json() as { msg?: string }
        return new Response(JSON.stringify({ error: error.msg || 'Signup failed' }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const result = await response.json() as { access_token: string; user: { id: string; email: string } }
      
      return new Response(JSON.stringify({
        token: result.access_token,
        user: { id: result.user.id, email: result.user.email }
      }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('❌ Signup error:', error)
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  if (path === '/api/auth/login') {
    if (!isSupabaseConfigured(env)) {
      return new Response(JSON.stringify({ error: 'Authentication not configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    try {
      const body = await request.json() as { email: string; password: string }
      const { email, password } = body
      
      if (!email || !password) {
        return new Response(JSON.stringify({ error: 'Email and password required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const response = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'apikey': env.SUPABASE_SERVICE_ROLE,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })

      if (!response.ok) {
        const error = await response.json() as { msg?: string }
        return new Response(JSON.stringify({ error: error.msg || 'Invalid credentials' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const result = await response.json() as { access_token: string; user: { id: string; email: string } }

      return new Response(JSON.stringify({
        token: result.access_token,
        user: { id: result.user.id, email: result.user.email }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('❌ Login error:', error)
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  return new Response('Not found', { status: 404, headers: corsHeaders })
}

async function authenticateRequest(request: Request, env: Env): Promise<string | null> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  const user = await verifySupabaseToken(token, env)
  return user?.sub || null
}

async function handleJobs(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname
  const method = request.method

  if (path === '/api/jobs' && method === 'POST') {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.substring(7)
    const user = await verifySupabaseToken(token, env)
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    try {
      const body = await request.json() as { prompt: string }
      const { prompt } = body
      if (!prompt) {
        return new Response(JSON.stringify({ error: 'Prompt required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const job = await createJob(user.sub, prompt, env)
      
      return new Response(JSON.stringify(job), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (error) {
      console.error('❌ Job creation error:', error)
      return new Response(JSON.stringify({ error: (error as any).message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  if (path.startsWith('/api/jobs/') && method === 'GET') {
    const jobId = path.split('/')[3]
    if (!jobId) {
      return new Response(JSON.stringify({ error: 'Job ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.substring(7)
    const user = await verifySupabaseToken(token, env)
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    try {
      const job = await getJob(jobId, user.sub, env)
      if (!job) {
        return new Response(JSON.stringify({ error: 'Job not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify(job), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (error) {
      console.error('❌ Job retrieval error:', error)
      return new Response(JSON.stringify({ error: (error as any).message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  if (path === '/api/jobs' && method === 'GET') {
    const userId = await authenticateRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    try {
      const userJobs = await supabaseRequest(env, 'GET', `jobs?user_id=eq.${userId}&order=created_at.desc`)
      return new Response(JSON.stringify({ jobs: userJobs }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (error) {
      console.error('Failed to get jobs:', error)
      return new Response(JSON.stringify({ error: 'Failed to get jobs' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function handleAssets(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname
  
  if (request.method === 'GET' && path.startsWith('/api/assets/')) {
    const assetId = path.split('/')[3]
    
    try {
      const object = await env.R2_BUCKET.get(assetId)
      if (!object) {
        return new Response('Asset not found', { status: 404, headers: corsHeaders })
      }

      const headers = new Headers(corsHeaders)
      headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream')
      headers.set('Content-Length', object.size.toString())
      
      if (url.searchParams.get('download') === '1') {
        headers.set('Content-Disposition', `attachment; filename="${assetId}"`)
      }

      return new Response(object.body, { headers })
    } catch (error) {
      return new Response('Failed to fetch asset', { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  return new Response('Not found', { status: 404, headers: corsHeaders })
}

async function handleWebhooks(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname

  if (request.method === 'POST' && path === '/api/webhooks/runpod') {
    try {
      const payload = await request.json()
      const { job_id, status, result_url } = payload as {
        job_id: string;
        status: string;
        result_url?: string;
      }

      if (!job_id) {
        return new Response(JSON.stringify({ error: 'Job ID required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const updates: Partial<Job> = { status: status as Job['status'] }
      if (result_url) updates.result_r2_key = result_url

      await updateJob(env, job_id, updates)

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (error) {
      console.error('Webhook processing error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return new Response(JSON.stringify({ 
        error: 'Webhook processing failed', 
        details: errorMessage 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  return new Response('Not found', { status: 404, headers: corsHeaders })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    const url = new URL(request.url)
    const path = url.pathname

    try {
      if (path === '/health') {
        return new Response(JSON.stringify({ 
          ok: true, 
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          supabase_configured: isSupabaseConfigured(env),
          runner_configured: !!(env.RUNPOD_API_KEY && env.RUNPOD_ENDPOINT_ID)
        }), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (path.startsWith('/api/auth/')) {
        return handleAuth(request, env)
      }

      if (path.startsWith('/api/jobs')) {
        return handleJobs(request, env)
      }

      if (path.startsWith('/api/assets/')) {
        return handleAssets(request, env)
      }

      if (path.startsWith('/api/webhooks/')) {
        return handleWebhooks(request, env)
      }

      return new Response('Not found', { status: 404, headers: corsHeaders })
    } catch (error) {
      console.error('Worker error:', error)
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  },
}
