import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const users = new Map<string, User>()
const jobs = new Map<string, Job>()

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
  return jwt.sign({ sub: userId }, secret, { expiresIn: '7d' })
}

function verifyToken(token: string, secret: string): { sub: string } | null {
  try {
    const decoded = jwt.verify(token, secret) as { sub: string }
    console.log(`🔐 JWT verified - sub: ${decoded.sub}`)
    return decoded
  } catch (error) {
    console.error('JWT verification failed:', error)
    return null
  }
}

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
  
  console.log(`DEBUG: Supabase request headers - apikey: ${env.SUPABASE_SERVICE_ROLE?.substring(0, 20)}..., Authorization: Bearer ${env.SUPABASE_SERVICE_ROLE?.substring(0, 20)}...`)

  console.log(`DEBUG: Supabase ${method} ${table} with service_role auth`)

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
    console.error(`❌ SUPABASE ERROR: ${method} ${table} failed`)
    console.error(`❌ Status: ${response.status} ${response.statusText}`)
    console.error(`❌ URL: ${url}`)
    console.error(`❌ Headers:`, JSON.stringify(headers, null, 2))
    console.error(`❌ Error Response:`, errorText)
    
    try {
      const errorJson = JSON.parse(errorText)
      console.error(`❌ Parsed Error:`, JSON.stringify(errorJson, null, 2))
      if (errorJson.message) {
        console.error(`❌ Error Message: ${errorJson.message}`)
      }
      if (errorJson.details) {
        console.error(`❌ Error Details: ${errorJson.details}`)
      }
      if (errorJson.hint) {
        console.error(`❌ Error Hint: ${errorJson.hint}`)
      }
    } catch (parseError) {
      console.error(`❌ Could not parse error response as JSON`)
    }
    
    throw new Error(`Supabase ${method} ${table} error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  return response.json()
}

async function createUser(env: Env, email: string, passwordHash: string): Promise<User> {
  if (!isSupabaseConfigured(env)) {
    console.error(`❌ PRODUCTION ERROR: Supabase not configured - DB is required in production`)
    throw new Error('Database not configured - service unavailable')
  }

  const user = {
    email,
    password_hash: passwordHash,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  console.log(`🔧 Creating user ${email} - letting database generate users.id`)

  try {
    const [created] = await supabaseRequest(env, 'POST', 'users', user)
    console.log(`✅ User created with database-generated ID: ${created.id}`)
    console.log(`🔐 JWT will use database users.id: ${created.id}`)
    users.set(created.id, created)
    return created
  } catch (error) {
    console.error('❌ CRITICAL: User creation failed in createUser function')
    console.error('❌ Error:', error)
    throw new Error(`User creation failed: ${(error as any)?.message || 'Unknown error'}`)
  }
}

async function getUserByEmail(env: Env, email: string): Promise<User | null> {
  if (!isSupabaseConfigured(env)) {
    console.error(`❌ PRODUCTION ERROR: Supabase not configured - DB is required in production`)
    throw new Error('Database not configured - service unavailable')
  }

  try {
    console.log(`🔍 Getting user by email from Supabase: ${email}`)
    const usersResult = await supabaseRequest(env, 'GET', 'users', null, `email=eq.${email}`)
    
    if (usersResult && usersResult.length > 0) {
      const user = usersResult[0]
      console.log(`✅ Found user in Supabase: ${user.id}, email: ${user.email}`)
      users.set(user.id, user)
      return user
    } else {
      console.log(`❌ No user found in Supabase with email ${email}`)
      return null
    }
  } catch (error) {
    console.error('❌ CRITICAL: getUserByEmail failed')
    console.error('❌ Error:', error)
    throw new Error(`User lookup failed: ${(error as any)?.message || 'Unknown error'}`)
  }
}

async function getUserById(env: Env, id: string): Promise<User | null> {
  if (!isSupabaseConfigured(env)) {
    console.error(`❌ PRODUCTION ERROR: Supabase not configured - DB is required in production`)
    throw new Error('Database not configured - service unavailable')
  }

  try {
    const usersResult = await supabaseRequest(env, 'GET', 'users', null, `id=eq.${id}`)
    return usersResult[0] || null
  } catch (error) {
    console.error('❌ CRITICAL: getUserById failed')
    console.error('❌ Error:', error)
    throw new Error(`User lookup failed: ${(error as any)?.message || 'Unknown error'}`)
  }
}

async function createJob(env: Env, userId: string, prompt: string): Promise<Job> {
  if (!isSupabaseConfigured(env)) {
    console.error(`❌ PRODUCTION ERROR: Supabase not configured - DB is required in production`)
    throw new Error('Database not configured - service unavailable')
  }
  
  console.log(`🎬 Creating job for user ${userId}`)
  console.log(`🔍 DIAGNOSTIC CREATE: user_id=${userId} (from JWT.sub), prompt="${prompt}"`)
  console.log(`📝 Inserting job into Supabase with service_role`)
  
  try {
    console.log(`🔍 DIAGNOSTIC: Attempting REST approach first...`)
    const jobData = {
      user_id: userId,
      prompt: prompt,
      status: 'queued'
    }
    
    try {
      console.log(`🔍 DIAGNOSTIC: Job creation with explicit status:`, JSON.stringify(jobData, null, 2))
      const [created] = await supabaseRequest(env, 'POST', 'jobs', jobData)
      console.log(`✅ Job ${created.id} created successfully via REST`)
      console.log(`🔍 DIAGNOSTIC CREATE: inserted_user_id=${created.user_id}, status=${created.status}`)
      
      await triggerRunpodJob(env, created)
      return created
    } catch (restError) {
      console.error(`❌ REST approach failed:`, (restError as any)?.message)
      
      if ((restError as any)?.message?.includes('PGRST204')) {
        console.log(`🔄 FALLBACK: Using RPC stored procedure to bypass PostgREST cache...`)
        
        const rpcResult = await supabaseRequest(env, 'POST', 'rpc/create_job_with_defaults', {
          p_user_id: userId,
          p_prompt: prompt
        })
        
        if (rpcResult && rpcResult.length > 0) {
          const created = rpcResult[0]
          console.log(`✅ Job ${created.id} created via RPC stored procedure`)
          console.log(`🔍 DIAGNOSTIC CREATE: inserted_user_id=${created.user_id}, status=${created.status}`)
          
          await triggerRunpodJob(env, created)
          return created
        } else {
          throw new Error('RPC job creation failed - no result returned')
        }
      } else {
        throw restError
      }
    }
    
  } catch (error) {
    console.error(`❌ CRITICAL: Job creation failed in createJob function`)
    console.error(`❌ Error type:`, error?.constructor?.name || 'Unknown')
    console.error(`❌ Error message:`, (error as any)?.message || 'Unknown error')
    console.error(`❌ Full error:`, error)
    console.error(`❌ User ID from JWT.sub:`, userId)
    
    if ((error as any)?.message?.includes('PGRST204')) {
      console.error(`❌ PostgREST schema cache issue detected - column not found in cache`)
    }
    
    throw new Error(`Job creation failed: ${(error as any)?.message || 'Unknown error'}`)
  }
}

async function getJobForUser(env: Env, jobId: string, userId: string): Promise<Job | null> {
  console.log(`🔍 Getting job ${jobId} for user ${userId}`)
  
  if (!isSupabaseConfigured(env)) {
    console.error(`❌ PRODUCTION ERROR: Supabase not configured - DB is required in production`)
    throw new Error('Database not configured - service unavailable')
  }

  try {
    const result = await supabaseRequest(env, 'GET', 'jobs', null, `id=eq.${jobId}`)
    console.log(`🔍 Found ${result.length} jobs with id ${jobId}`)
    
    if (result.length > 0) {
      const job = result[0]
      console.log(`🔍 Job found - job.user_id=${job.user_id}, jwt.sub=${userId}`)
      
      if (job.user_id !== userId) {
        console.log(`❌ Ownership check failed - job.user_id=${job.user_id} !== jwt.sub=${userId}`)
        return null
      }
      
      console.log(`✅ Job ${jobId} ownership verified for user ${userId}`)
      return job
    } else {
      console.log(`❌ Job ${jobId} not found in database`)
      return null
    }
  } catch (error) {
    console.error(`❌ CRITICAL: getJobForUser failed for job ${jobId}, user ${userId}`)
    console.error('❌ Error:', error)
    throw new Error(`Job lookup failed: ${(error as any)?.message || 'Unknown error'}`)
  }
}

async function getJob(env: Env, id: string): Promise<Job | null> {
  if (isSupabaseConfigured(env)) {
    try {
      const jobsResult = await supabaseRequest(env, 'GET', 'jobs', null, `id=eq.${id}`)
      return jobsResult.length > 0 ? jobsResult[0] : null
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
      // Fallback to in-memory storage if Supabase fails
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
      // Fallback to in-memory storage if Supabase fails
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

      console.log(`✅ Signup successful - user.id: ${user.id}, JWT.sub: ${user.id}`)

      return new Response(JSON.stringify({
        user: { id: user.id, email: user.email },
        token,
      }), {
        status: 201,
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
        console.log(`DEBUG: User not found for email ${email}`)
        return new Response(JSON.stringify({ 
          error: 'Invalid credentials',
          debug: 'User not found in database'
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      console.log(`DEBUG: Verifying password for user ${user.id}`)
      console.log(`DEBUG: Stored hash: ${user.password_hash?.substring(0, 20)}...`)
      console.log(`DEBUG: Input password length: ${password.length}`)
      console.log(`DEBUG: Hash algorithm check: ${user.password_hash?.startsWith('$2b$') ? 'bcrypt' : 'unknown'}`)
      const isValid = await verifyPassword(password, user.password_hash)
      console.log(`DEBUG: Password verification result: ${isValid}`)
      if (!isValid) {
        console.log(`DEBUG: Password verification failed for user ${user.email}`)
        console.log(`DEBUG: This suggests either hash mismatch or RLS blocking service_role access`)
        return new Response(JSON.stringify({ 
          error: 'Invalid credentials',
          debug: `Password verification failed. Hash starts with: ${user.password_hash?.substring(0, 10)}..., Algorithm: ${user.password_hash?.startsWith('$2b$') ? 'bcrypt' : 'unknown'}`
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const token = generateToken(user.id, env.JWT_SECRET)

      console.log(`✅ Login successful - user.id: ${user.id}, JWT.sub: ${user.id}`)

      return new Response(JSON.stringify({
        user: { id: user.id, email: user.email },
        token,
      }), {
        status: 200,
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
  return payload?.sub || null
}

async function handleJobs(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname
  const method = request.method

  if (path === '/api/jobs' && method === 'POST') {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`❌ POST /api/jobs: Missing or invalid Authorization header`)
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.substring(7)
    const decoded = verifyToken(token, env.JWT_SECRET)
    if (!decoded) {
      console.log(`❌ POST /api/jobs: Invalid JWT token`)
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { prompt } = await request.json() as { prompt: string }

    if (!prompt) {
      console.log(`❌ POST /api/jobs: Missing prompt`)
      return new Response(JSON.stringify({ error: 'Prompt required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`🎬 POST /api/jobs: Creating job for user ${decoded.sub}`)

    try {
      const job = await createJob(env, decoded.sub, prompt)
      console.log(`✅ POST /api/jobs: Job ${job.id} created successfully`)
      
      return new Response(JSON.stringify({ job }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (error) {
      console.error(`❌ POST /api/jobs: Job creation failed:`, error)
      console.error(`❌ POST /api/jobs: Error type:`, error?.constructor?.name || 'Unknown')
      console.error(`❌ POST /api/jobs: Error message:`, (error as any)?.message || 'No message')
      console.error(`❌ POST /api/jobs: User ID:`, decoded.sub)
      console.error(`❌ POST /api/jobs: Prompt:`, prompt)
      
      const errorMessage = (error as any)?.message || 'Unknown error'
      const isSupabaseError = errorMessage.includes('Supabase')
      const isConstraintError = errorMessage.includes('constraint') || errorMessage.includes('foreign key')
      const isRLSError = errorMessage.includes('RLS') || errorMessage.includes('policy')
      
      console.error(`❌ POST /api/jobs: Error analysis - Supabase: ${isSupabaseError}, Constraint: ${isConstraintError}, RLS: ${isRLSError}`)
      
      return new Response(JSON.stringify({ 
        error: 'Failed to create job',
        debug: {
          message: errorMessage,
          user_id: decoded.sub,
          supabase_error: isSupabaseError,
          constraint_error: isConstraintError,
          rls_error: isRLSError
        }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  if (path.startsWith('/api/jobs/') && method === 'GET') {
    const jobId = path.split('/')[3]
    if (!jobId) {
      console.log(`❌ GET /api/jobs: Missing job ID`)
      return new Response(JSON.stringify({ error: 'Job ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authHeader = request.headers.get('Authorization')
    console.log(`🔍 DIAGNOSTIC GET: auth_header_present=${!!authHeader}, job_id=${jobId}`)
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`❌ GET /api/jobs/${jobId}: Missing or invalid Authorization header`)
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.substring(7)
    const decoded = verifyToken(token, env.JWT_SECRET)
    if (!decoded) {
      console.log(`❌ GET /api/jobs/${jobId}: Invalid JWT token`)
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`🔍 DIAGNOSTIC GET: jwt_sub=${decoded.sub}, job_id=${jobId}`)

    try {
      const job = await getJobForUser(env, jobId, decoded.sub)
      if (!job) {
        console.log(`❌ GET /api/jobs/${jobId}: Job not found for user ${decoded.sub}`)
        return new Response(JSON.stringify({ error: 'Job not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (job.user_id !== decoded.sub) {
        console.log(`❌ GET /api/jobs/${jobId}: Access denied - ownership mismatch`)
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      console.log(`✅ GET /api/jobs/${jobId}: Job found and returned successfully`)
      return new Response(JSON.stringify({ job }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (error) {
      console.error(`❌ GET /api/jobs/${jobId}: Database error:`, error)
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
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
      const userJobs = await getUserJobs(env, userId)
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
          runner_configured: !!(env.RUNPOD_API_KEY && env.RUNPOD_ENDPOINT_ID),
          jwt_configured: isJWTConfigured(env)
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
