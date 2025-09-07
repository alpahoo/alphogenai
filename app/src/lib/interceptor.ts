let authToken: string | null = null

export function setAuthToken(token: string) {
  authToken = token
  if (typeof window !== 'undefined') {
    localStorage.setItem('auth_token', token)
  }
}

export function getAuthToken(): string | null {
  if (authToken) return authToken
  
  if (typeof window !== 'undefined') {
    authToken = localStorage.getItem('auth_token')
  }
  
  return authToken
}

export function clearAuthToken() {
  authToken = null
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token')
  }
}

const originalFetch = fetch

window.fetch = function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  
  if (url.includes('/api/jobs')) {
    const token = getAuthToken()
    if (token) {
      init = init || {}
      init.headers = {
        ...init.headers,
        'Authorization': `Bearer ${token}`
      }
      console.log(`🔐 Added Authorization header to ${url}`)
    } else {
      console.warn(`⚠️ No auth token available for ${url}`)
    }
  }
  
  return originalFetch(input, init)
}
