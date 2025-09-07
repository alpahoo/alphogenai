let authToken: string | null = null

export function setAuthToken(token: string | null) {
  authToken = token
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('auth_token', token)
    } else {
      localStorage.removeItem('auth_token')
    }
  }
}

export function getAuthToken(): string | null {
  if (typeof window !== 'undefined' && !authToken) {
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

if (typeof window !== 'undefined') {
  const originalFetch = window.fetch
  
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    
    if (url.includes('/api/jobs')) {
      const token = getAuthToken()
      if (token) {
        init = init || {}
        init.headers = {
          ...init.headers,
          'Authorization': `Bearer ${token}`
        }
        console.log(`🔐 Adding Authorization header to ${url}`)
      } else {
        console.warn(`⚠️ No auth token available for ${url}`)
      }
    }
    
    return originalFetch(input, init)
  }
  
  authToken = localStorage.getItem('auth_token')
  if (authToken) {
    console.log('🔐 Auth token loaded from localStorage on page load')
  }
}
