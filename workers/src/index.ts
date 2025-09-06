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
  return jwt.sign({ userId }, secret, { expiresIn: '7d' })
}

function verifyToken(token: string, secret: string): { userId: string } | null {
  try {
    return jwt.verify(token, secret) as { userId: string }
  } catch {
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
    console.error(`Supabase ${method} ${table} failed:`, response.status, response.statusText, errorText)
    console.error(`Request URL: ${url}`)
    console.error(`Request headers:`, headers)
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

  console.log(`DEBUG: Creating user ${email} with service_role auth`)
  console.log(`DEBUG: Password hash length: ${passwordHash.length}`)
  console.log(`DEBUG: Generated user ID: ${user.id}`)

  if (isSupabaseConfigured(env)) {
    try {
      console.log(`DEBUG: Attempting to create user in Supabase with service_role`)
      const [created] = await supabaseRequest(env, 'POST', 'users', user)
      console.log(`DEBUG: User created successfully in Supabase: ${created.id}`)
      console.log(`DEBUG: Supabase returned user email: ${created.email}`)
      console.log(`DEBUG: Supabase returned password_hash length: ${created.password_hash?.length}`)
      
      users.set(created.id, created)
      console.log(`DEBUG: User also stored in memory for consistency`)
      
      return created
    } catch (error) {
      console.error('Supabase createUser error:', error)
      console.log(`DEBUG: Falling back to in-memory storage for user creation`)
      // Fallback to in-memory storage if Supabase fails
      users.set(user.id, user)
      return user
    }
  } else {
    console.log(`DEBUG: Supabase not configured, storing user in memory`)
    users.set(user.id, user)
    return user
  }
}

async function getUserByEmail(env: Env, email: string): Promise<User | null> {
  console.log(`DEBUG: getUserByEmail called for: ${email}`)
  console.log(`DEBUG: In-memory users count: ${users.size}`)
  console.log(`DEBUG: Supabase configured: ${isSupabaseConfigured(env)}`)
  console.log(`DEBUG: SUPABASE_URL: ${env.SUPABASE_URL?.substring(0, 50)}...`)
  console.log(`DEBUG: SUPABASE_SERVICE_ROLE: ${env.SUPABASE_SERVICE_ROLE?.substring(0, 20)}...`)
  
  if (isSupabaseConfigured(env)) {
    try {
      console.log(`DEBUG: Getting user by email from Supabase: ${email}`)
      console.log(`DEBUG: Query URL: ${env.SUPABASE_URL}/rest/v1/users?email=eq.${email}`)
      
      const usersResult = await supabaseRequest(env, 'GET', 'users', null, `email=eq.${email}`)
      console.log(`DEBUG: Supabase query returned ${usersResult?.length || 0} users for email ${email}`)
      console.log(`DEBUG: Raw Supabase response:`, JSON.stringify(usersResult))
      
      if (usersResult && usersResult.length > 0) {
        const user = usersResult[0]
        console.log(`DEBUG: Found user in Supabase: ${user.id}, email: ${user.email}`)
        console.log(`DEBUG: Supabase user password_hash length: ${user.password_hash?.length}`)
        console.log(`DEBUG: Supabase user password_hash starts with: ${user.password_hash?.substring(0, 10)}...`)
        
        users.set(user.id, user)
        console.log(`DEBUG: User cached in memory for future lookups`)
        
        return user
      } else {
        console.log(`DEBUG: No user found in Supabase with email ${email}`)
        console.log(`DEBUG: Checking if user exists in in-memory storage...`)
        for (const user of users.values()) {
          if (user.email === email) {
            console.log(`DEBUG: Found user in in-memory storage: ${user.id}`)
            console.log(`DEBUG: In-memory user password_hash length: ${user.password_hash?.length}`)
            return user
          }
        }
        console.log(`DEBUG: User not found in either Supabase or in-memory storage`)
        return null
      }
    } catch (error) {
      console.error('Supabase getUserByEmail error:', error)
      console.log(`DEBUG: Supabase error details:`, (error as Error).message || error)
      console.log(`DEBUG: Falling back to in-memory storage for email ${email}`)
      
      for (const user of users.values()) {
        if (user.email === email) {
          console.log(`DEBUG: Found user in in-memory storage after Supabase error: ${user.id}`)
          console.log(`DEBUG: In-memory user password_hash length: ${user.password_hash?.length}`)
          return user
        }
      }
      console.log(`DEBUG: User not found in in-memory storage either`)
      return null
    }
  } else {
    console.log(`DEBUG: Supabase not configured, checking in-memory storage for email ${email}`)
    for (const user of users.values()) {
      if (user.email === email) {
        console.log(`DEBUG: Found user in in-memory storage: ${user.id}`)
        return user
      }
    }
    console.log(`DEBUG: User not found in in-memory storage`)
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
  console.log(`🎬 Creating job for user ${userId} with prompt: ${prompt.substring(0, 50)}...`)
  
  if (!isSupabaseConfigured(env)) {
    console.error(`❌ PRODUCTION ERROR: Supabase not configured - DB is required in production`)
    throw new Error('Database not configured - service unavailable')
  }
  
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

  console.log(`📝 Inserting job ${job.id} into Supabase for user ${userId}`)
  console.log(`🔍 DIAGNOSTIC POST: About to insert job with user_id=${userId}, job_id=${job.id}`)
  
  try {
    const [created] = await supabaseRequest(env, 'POST', 'jobs', job)
    console.log(`✅ Job ${job.id} created successfully in Supabase`)
    console.log(`🔍 DIAGNOSTIC POST: inserted_user_id=${userId}, job_id=${job.id}`)
    
    console.log(`🔍 Verifying job exists immediately after creation...`)
    const verifyResult = await supabaseRequest(env, 'GET', 'jobs', null, `id=eq.${job.id}`)
    console.log(`🔍 DIAGNOSTIC VERIFY: job_id=${job.id}, rows_found=${verifyResult.length}, exists=${verifyResult.length > 0}`)
    
    if (verifyResult.length > 0) {
      console.log(`✅ Job ${job.id} confirmed to exist in database`)
    } else {
      console.error(`❌ Job ${job.id} NOT found in database immediately after creation!`)
    }
    
    jobs.set(created.id, created)
    await triggerRunpodJob(env, created)
    return created
  } catch (error) {
    console.error(`❌ Error creating job in Supabase:`, error)
    throw error
  }
}

async function getJobForUser(env: Env, jobId: string, userId: string): Promise<Job | null> {
  console.log(`🔍 Getting job ${jobId} for user ${userId}`)
  
  if (!isSupabaseConfigured(env)) {
    console.error(`❌ PRODUCTION ERROR: Supabase not configured - DB is required in production`)
    throw new Error('Database not configured - service unavailable')
  }
  
  console.log(`📖 Querying Supabase for job ${jobId}`)
  console.log(`🔍 DIAGNOSTIC GET: job_id=${jobId}, jwt_sub=${userId}, query_user_id_used=${userId}`)
  
  try {
    const jobsResult = await supabaseRequest(env, 'GET', 'jobs', null, `id=eq.${jobId}&user_id=eq.${userId}`)
    console.log(`🔍 DIAGNOSTIC GET: rows_found=${jobsResult.length}`)
    console.log(`📊 Supabase returned ${jobsResult.length} jobs for query`)
    
    if (jobsResult.length > 0) {
      console.log(`✅ Job ${jobId} found in Supabase`)
      return jobsResult[0]
    }
    
    console.log(`🔍 Testing unfiltered query to check if job exists at all...`)
    const unfilteredResult = await supabaseRequest(env, 'GET', 'jobs', null, `id=eq.${jobId}`)
    console.log(`🔍 DIAGNOSTIC UNFILTERED: job exists=${unfilteredResult.length > 0}, owner_user_id=${unfilteredResult.length > 0 ? unfilteredResult[0].user_id : 'N/A'}`)
    
    if (unfilteredResult.length > 0 && unfilteredResult[0].user_id !== userId) {
      console.log(`❌ OWNERSHIP MISMATCH: job.user_id=${unfilteredResult[0].user_id} !== jwt.sub=${userId}`)
      return null
    }
    
    console.log(`❌ Job ${jobId} not found in database`)
    return null
  } catch (error) {
    console.error(`❌ Error querying Supabase for job:`, error)
    throw error
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

    console.log(`🎬 POST /api/jobs: Creating job for user ${decoded.userId}`)

    try {
      const job = await createJob(env, decoded.userId, prompt)
      console.log(`✅ POST /api/jobs: Job ${job.id} created successfully`)
      
      return new Response(JSON.stringify({ job }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (error) {
      console.error(`❌ POST /api/jobs: Job creation failed:`, error)
      return new Response(JSON.stringify({ error: 'Failed to create job' }), {
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

    console.log(`🔍 DIAGNOSTIC GET: jwt_sub=${decoded.userId}, job_id=${jobId}`)

    try {
      const job = await getJobForUser(env, jobId, decoded.userId)
      if (!job) {
        console.log(`❌ GET /api/jobs/${jobId}: Job not found for user ${decoded.userId}`)
        return new Response(JSON.stringify({ error: 'Job not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (job.user_id !== decoded.userId) {
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
