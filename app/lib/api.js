const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://api.alphogen.com'

export const api = {
  async get(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'GET',
      ...options,
    })
    return response.json()
  },

  async post(endpoint, data, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(data),
      ...options,
    })
    return response.json()
  },

  async put(endpoint, data, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': options.contentType || 'application/json',
        ...options.headers,
      },
      body: options.contentType === 'text/plain' ? data : JSON.stringify(data),
      ...options,
    })
    return response.json()
  },

  generateCurl(method, endpoint, data = null, headers = {}) {
    const url = `${API_BASE}${endpoint}`
    let curl = `curl -X ${method} "${url}"`
    
    Object.entries(headers).forEach(([key, value]) => {
      curl += ` \\\n  -H "${key}: ${value}"`
    })
    
    if (data) {
      if (typeof data === 'string') {
        curl += ` \\\n  -d '${data}'`
      } else {
        curl += ` \\\n  -d '${JSON.stringify(data)}'`
      }
    }
    
    return curl
  }
}
