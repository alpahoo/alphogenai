const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://api.alphogen.com'

export interface User {
  id: string
  email: string
}

export interface Job {
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

export interface AuthResponse {
  user: User
  token: string
}

export interface JobResponse {
  job: Job
}

export interface JobsResponse {
  jobs: Job[]
}

class ApiClient {
  private token: string | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token')
    }
  }

  setToken(token: string) {
    this.token = token
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token)
    }
  }

  clearToken() {
    this.token = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token')
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    if (this.token) {
      (headers as any).Authorization = `Bearer ${this.token}`
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`API Error: ${response.status} ${error}`)
    }

    return response.json()
  }

  async signup(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  async createJob(prompt: string): Promise<JobResponse> {
    return this.request<JobResponse>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    })
  }

  async getJob(id: string): Promise<JobResponse> {
    return this.request<JobResponse>(`/api/jobs/${id}`)
  }

  async getJobs(): Promise<JobsResponse> {
    return this.request<JobsResponse>('/api/jobs')
  }

  async getAssetUrl(id: string): Promise<string> {
    return `${API_BASE}/api/assets/${id}`
  }
}

export const api = new ApiClient()
