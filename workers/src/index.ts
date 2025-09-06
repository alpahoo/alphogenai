import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

interface Env {
  R2_BUCKET: R2Bucket
  JWT_SECRET: string
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE: string
  RUNPOD_API_KEY: string
  RUNPOD_ENDPOINT_ID: string
}

interface User {
  id: string
  email: string
  password_hash: string
  created_at: string
  updated_at: string
}

interface Job {
  id: string
  user_id: string
  prompt: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  result_url: string | null
  error_message: string | null
  runpod_job_id: string | null
  created_at: string
  updated_at: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function generateId(): string {
  return crypto.randomUUID()
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

function generateToken(userId: string, secret: string): string {
  return jwt.sign({ userId }, secret, { expiresIn: '7d' })
}

function verifyToken(token: string, secret: string): { userId: string } | null {
  try {
    return jwt.verify(token, secret) as { userId: string }
  } catch {
    return null
  }
}

const users = new Map()
const jobs = new Map()

function isSupabaseConfigured(env: Env): boolean {
  return !!(env.SUPABASE_URL && 
         env.SUPABASE_SERVICE_ROLE && 
         env.SUPABASE_URL !== 'your_supabase_url' &&
         env.SUPABASE_SERVICE_ROLE !== 'your_supabase_service_role_key')
}

function isJWTConfigured(env: Env): boolean {
  return !!(env.JWT_SECRET && env.JWT_SECRET.length > 0)
}

async function supabaseRequest(env: Env, method: string, table: string, data?: any, filters?: string): Promise<any> {
  const url = `${env.SUPABASE_URL}/rest/v1/${table}${filters ? `?${filters}` : ''}`
  
  const headers: Record<string, string> = {
    'apikey': env.SUPABASE_SERVICE_ROLE,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  }

  const options: RequestInit = {
    method,
    headers,
  }

  if (data) {
    options.body = JSON.stringify(data)
  }

  const response = await fetch(url, options)
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error(`Supabase ${method} ${table} failed:`, response.status, response.statusText, errorText)
    throw new Error(`Supabase error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

async function createUser(env: Env, email: string, passwordHash: string): Promise<User> {
  const user = {
    id: generateId(),
    email,
    password_hash: passwordHash,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (isSupabaseConfigured(env)) {
    try {
      const [created] = await supabaseRequest(env, 'POST', 'users', user)
      return created
    } catch (error) {
      console.error('Supabase createUser error:', error)
      // Fallback to in-memory storage if Supabase fails
      users.set(user.id, user)
      return user
    }
  } else {
    users.set(user.id, user)
    return user
  }
}

async function getUserByEmail(env: Env, email: string): Promise<User | null> {
  if (isSupabaseConfigured(env)) {
    try {
      const usersResult = await supabaseRequest(env, 'GET', 'users', null, `email=eq.${email}`)
      return usersResult[0] || null
    } catch (error) {
      console.error('Supabase getUserByEmail error:', error)
      // Fallback to in-memory storage if Supabase fails
      for (const user of users.values()) {
        if (user.email === email) {
          return user
        }
      }
      return null
    }
  } else {
    for (const user of users.values()) {
      if (user.email === email) {
        return user
      }
    }
    return null
  }
}

async function getUserById(env: Env, id: string): Promise<User | null> {
  if (isSupabaseConfigured(env)) {
    const usersResult = await supabaseRequest(env, 'GET', 'users', null, `id=eq.${id}`)
    return usersResult[0] || null
  } else {
    return users.get(id) || null
  }
}

async function createJob(env: Env, userId: string, prompt: string): Promise<Job> {
  const job = {
    id: generateId(),
    user_id: userId,
    prompt,
    status: 'queued' as const,
    result_url: null,
    error_message: null,
    runpod_job_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (isSupabaseConfigured(env)) {
    try {
      const [created] = await supabaseRequest(env, 'POST', 'jobs', job)
      await triggerRunpodJob(env, created)
      return created
    } catch (error) {
      console.error('Supabase createJob error:', error)
      jobs.set(job.id, job)
      await triggerRunpodJob(env, job)
      return job
    }
  } else {
    jobs.set(job.id, job)
    await triggerRunpodJob(env, job)
    return job
  }
}

async function getJob(env: Env, id: string): Promise<Job | null> {
  if (isSupabaseConfigured(env)) {
    try {
      const jobsResult = await supabaseRequest(env, 'GET', 'jobs', null, `id=eq.${id}`)
      return jobsResult[0] || null
    } catch (error) {
      console.error('Supabase getJob error:', error)
      return jobs.get(id) || null
    }
  } else {
    return jobs.get(id) || null
  }
}

async function getUserJobs(env: Env, userId: string): Promise<Job[]> {
  if (isSupabaseConfigured(env)) {
    try {
      return supabaseRequest(env, 'GET', 'jobs', null, `user_id=eq.${userId}&order=created_at.desc`)
    } catch (error) {
      console.error('Supabase getUserJobs error:', error)
      const userJobs = Array.from(jobs.values()).filter(job => job.user_id === userId)
      return userJobs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
  } else {
    const userJobs = Array.from(jobs.values()).filter(job => job.user_id === userId)
    return userJobs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }
}

async function updateJob(env: Env, id: string, updates: Partial<Job>): Promise<Job> {
  const updateData = {
    ...updates,
    updated_at: new Date().toISOString(),
  }

  if (isSupabaseConfigured(env)) {
    try {
      const [updated] = await supabaseRequest(env, 'PATCH', 'jobs', updateData, `id=eq.${id}`)
      return updated
    } catch (error) {
      console.error('Supabase updateJob error:', error)
      const existingJob = jobs.get(id)
      if (existingJob) {
        const updatedJob = { ...existingJob, ...updateData }
        jobs.set(id, updatedJob)
        return updatedJob
      }
      throw new Error('Job not found')
    }
  } else {
    const existingJob = jobs.get(id)
    if (existingJob) {
      const updatedJob = { ...existingJob, ...updateData }
      jobs.set(id, updatedJob)
      return updatedJob
    }
    throw new Error('Job not found')
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
        runpod_job_id: (result as any).id,
        status: 'processing',
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
    const { email, password } = await request.json() as { email: string; password: string }

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    try {
      const existingUser = await getUserByEmail(env, email)
      if (existingUser) {
        return new Response(JSON.stringify({ error: 'User already exists' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const passwordHash = await hashPassword(password)
      const user = await createUser(env, email, passwordHash)
      const token = generateToken(user.id, env.JWT_SECRET)

      return new Response(JSON.stringify({
        user: { id: user.id, email: user.email },
        token,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (error) {
      console.error('Signup error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return new Response(JSON.stringify({ error: 'Failed to create user', details: errorMessage }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  if (path === '/api/auth/login') {
    const { email, password } = await request.json() as { email: string; password: string }

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    try {
      const user = await getUserByEmail(env, email)
      if (!user) {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const isValid = await verifyPassword(password, user.password_hash)
      if (!isValid) {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const token = generateToken(user.id, env.JWT_SECRET)

      return new Response(JSON.stringify({
        user: { id: user.id, email: user.email },
        token,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (error) {
      console.error('Login error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return new Response(JSON.stringify({ error: 'Login failed', details: errorMessage }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
  const payload = verifyToken(token, env.JWT_SECRET)
  return payload?.userId || null
}

async function handleJobs(request: Request, env: Env): Promise<Response> {
  const userId = await authenticateRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(request.url)
  const path = url.pathname

  if (request.method === 'POST' && path === '/api/jobs') {
    const { prompt } = await request.json() as { prompt: string }

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    try {
      const job = await createJob(env, userId, prompt)
      return new Response(JSON.stringify({ job }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (error) {
      console.error('Job creation error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return new Response(JSON.stringify({ 
        error: 'Failed to create job', 
        details: errorMessage 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  if (request.method === 'GET' && path === '/api/jobs') {
    try {
      const jobs = await getUserJobs(env, userId)
      return new Response(JSON.stringify({ jobs }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to fetch jobs' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  if (request.method === 'GET' && path.startsWith('/api/jobs/')) {
    const jobId = path.split('/')[3]
    
    try {
      const job = await getJob(env, jobId)
      if (!job) {
        return new Response(JSON.stringify({ error: 'Job not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (job.user_id !== userId) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ job }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to fetch job' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  return new Response('Not found', { status: 404, headers: corsHeaders })
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
      const { job_id, status, result_url, error_message } = payload as {
        job_id: string;
        status: string;
        result_url?: string;
        error_message?: string;
      }

      if (!job_id) {
        return new Response(JSON.stringify({ error: 'Job ID required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const updates: Partial<Job> = { status: status as Job['status'] }
      if (result_url) updates.result_url = result_url
      if (error_message) updates.error_message = error_message

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
          runpod_configured: !!(env.RUNPOD_API_KEY && env.RUNPOD_ENDPOINT_ID),
          jwt_configured: isJWTConfigured(env)
        }), {
          status: 200,
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
