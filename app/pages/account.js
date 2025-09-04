import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import toast from 'react-hot-toast'

export default function Account() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      if (!supabase) {
        setLoading(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      
      if (user) {
        await fetchProfile(user.access_token)
      }
    } catch (error) {
      console.error('Error checking user:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchProfile = async (token) => {
    try {
      const response = await api.get('/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        setProfile(response)
        if (response.provider === 'noop') {
          toast.info('Profil en mode noop (Supabase non configuré)')
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    
    if (!supabase) {
      toast.error('Authentification non configurée')
      return
    }

    if (!email || !password) {
      toast.error('Veuillez remplir tous les champs')
      return
    }

    setLoginLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        toast.error('Erreur de connexion: ' + error.message)
      } else {
        toast.success('Connexion réussie')
        setUser(data.user)
        await fetchProfile(data.session.access_token)
        setEmail('')
        setPassword('')
      }
    } catch (error) {
      toast.error('Erreur de connexion')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLogout = async () => {
    if (!supabase) {
      toast.error('Authentification non configurée')
      return
    }

    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        toast.error('Erreur de déconnexion')
      } else {
        toast.success('Déconnexion réussie')
        setUser(null)
        setProfile(null)
      }
    } catch (error) {
      toast.error('Erreur de déconnexion')
    }
  }

  const copyCurlMe = () => {
    const token = user?.access_token || 'YOUR_JWT_TOKEN'
    const curl = `curl "${process.env.NEXT_PUBLIC_API_BASE || 'https://api.alphogen.com'}/me" \\
  -H "Authorization: Bearer ${token}"`
    
    navigator.clipboard.writeText(curl)
    toast.success('Commande cURL copiée')
  }

  if (loading) {
    return (
      <Layout>
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Chargement...</p>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  if (!supabase) {
    return (
      <Layout>
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Compte utilisateur</h1>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h2 className="text-lg font-medium text-yellow-900 mb-2">
                  Authentification non configurée
                </h2>
                <p className="text-yellow-800">
                  Pour utiliser l'authentification, configurez les variables d'environnement:
                </p>
                <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside">
                  <li><code>NEXT_PUBLIC_SUPABASE_URL</code></li>
                  <li><code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Compte utilisateur</h1>
          
          {!user ? (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Connexion</h2>
              
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="votre@email.com"
                  />
                </div>
                
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Mot de passe
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="••••••••"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  {loginLoading ? 'Connexion...' : 'Se connecter'}
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Profil utilisateur</h2>
                  <button
                    onClick={handleLogout}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    Se déconnecter
                  </button>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-500">Email:</span>
                    <p className="text-gray-900">{user.email}</p>
                  </div>
                  
                  <div>
                    <span className="text-sm font-medium text-gray-500">ID utilisateur:</span>
                    <p className="text-gray-900 font-mono text-sm">{user.id}</p>
                  </div>
                  
                  <div>
                    <span className="text-sm font-medium text-gray-500">Dernière connexion:</span>
                    <p className="text-gray-900">
                      {new Date(user.last_sign_in_at).toLocaleString('fr-FR')}
                    </p>
                  </div>
                </div>
              </div>

              {profile && (
                <div className="bg-white shadow rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">Profil API</h2>
                    <button
                      onClick={copyCurlMe}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                    >
                      Copier cURL
                    </button>
                  </div>
                  
                  <div className="bg-gray-50 rounded-md p-4">
                    <pre className="text-sm text-gray-600 overflow-x-auto">
                      {JSON.stringify(profile, null, 2)}
                    </pre>
                  </div>
                  
                  {profile.provider === 'noop' && (
                    <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-yellow-800 text-sm">
                        <strong>Mode noop:</strong> Supabase n'est pas entièrement configuré côté Worker.
                        L'authentification fonctionne côté frontend mais la validation JWT côté API est désactivée.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">Exemple cURL</h3>
            <div className="text-sm">
              <strong>Vérifier le profil:</strong>
              <code className="block bg-white p-2 rounded mt-1 text-xs">
                curl "https://api.alphogen.com/me" -H "Authorization: Bearer YOUR_JWT_TOKEN"
              </code>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
