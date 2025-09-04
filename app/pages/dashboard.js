import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { api } from '../lib/api'
import toast from 'react-hot-toast'

export default function Dashboard() {
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkHealth()
  }, [])

  const checkHealth = async () => {
    try {
      const response = await api.get('/health')
      setHealth(response)
      if (response.ok) {
        toast.success('API en ligne')
      }
    } catch (error) {
      toast.error('Erreur de connexion API')
    } finally {
      setLoading(false)
    }
  }

  const quickActions = [
    { name: 'Gérer les assets', href: '/assets', color: 'bg-blue-600 hover:bg-blue-700' },
    { name: 'Créer un job', href: '/jobs', color: 'bg-green-600 hover:bg-green-700' },
    { name: 'Tester webhooks', href: '/webhooks', color: 'bg-purple-600 hover:bg-purple-700' },
    { name: 'Mon compte', href: '/account', color: 'bg-gray-600 hover:bg-gray-700' },
    { name: 'Facturation', href: '/billing', color: 'bg-yellow-600 hover:bg-yellow-700' },
  ]

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard AlphoGenAI</h1>
          
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Statut de l'API</h2>
              
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-gray-600">Vérification...</span>
                </div>
              ) : health ? (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className={`w-3 h-3 rounded-full ${health.ok ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    <span className="font-medium">{health.ok ? 'En ligne' : 'Hors ligne'}</span>
                  </div>
                  {health.ts && (
                    <p className="text-sm text-gray-600">
                      Dernière vérification: {new Date(health.ts).toLocaleString('fr-FR')}
                    </p>
                  )}
                  {health.version && (
                    <p className="text-sm text-gray-600">Version: {health.version}</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  <span className="font-medium text-red-600">Erreur de connexion</span>
                </div>
              )}
              
              <button
                onClick={checkHealth}
                disabled={loading}
                className="mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                {loading ? 'Vérification...' : 'Actualiser'}
              </button>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Configuration</h2>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">API Base</span>
                  <span className="text-sm font-medium">
                    {process.env.NEXT_PUBLIC_API_BASE || 'https://api.alphogen.com'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Supabase</span>
                  <span className={`text-sm font-medium ${
                    process.env.NEXT_PUBLIC_SUPABASE_URL ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Configuré' : 'Non configuré'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Environnement</span>
                  <span className="text-sm font-medium">
                    {process.env.NODE_ENV || 'development'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Actions rapides</h2>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {quickActions.map((action) => (
                <a
                  key={action.name}
                  href={action.href}
                  className={`${action.color} text-white px-6 py-4 rounded-lg text-center font-medium transition-colors`}
                >
                  {action.name}
                </a>
              ))}
            </div>
          </div>

          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">Endpoints API disponibles</h3>
            <div className="text-sm text-blue-800 space-y-1">
              <div>• <code>GET /health</code> - Vérification de santé</div>
              <div>• <code>PUT/GET /assets/:key</code> - Gestion des fichiers</div>
              <div>• <code>POST /jobs</code> - Création de jobs vidéo</div>
              <div>• <code>POST /webhooks/test</code> - Test des webhooks</div>
              <div>• <code>GET /me</code> - Profil utilisateur</div>
              <div>• <code>POST /billing/checkout</code> - Paiements Stripe</div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
