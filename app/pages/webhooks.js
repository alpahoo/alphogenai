import { useState } from 'react'
import Layout from '../components/Layout'
import { api } from '../lib/api'
import toast from 'react-hot-toast'

export default function Webhooks() {
  const [loading, setLoading] = useState(false)
  const [testResults, setTestResults] = useState([])

  const handleTestWebhook = async () => {
    setLoading(true)
    try {
      const response = await api.post('/webhooks/test', { 
        test: true, 
        timestamp: new Date().toISOString(),
        source: 'frontend'
      })
      
      const result = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        success: response.ok,
        response: response,
        status: response.ok ? 'success' : 'error'
      }
      
      setTestResults(prev => [result, ...prev.slice(0, 9)])
      
      if (response.ok) {
        toast.success('Webhook testé avec succès')
      } else {
        toast.error('Erreur lors du test webhook')
      }
    } catch (error) {
      const result = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        success: false,
        response: { error: error.message },
        status: 'error'
      }
      
      setTestResults(prev => [result, ...prev.slice(0, 9)])
      toast.error('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  const copyCurlWebhook = () => {
    const curl = `curl -X POST "${process.env.NEXT_PUBLIC_API_BASE || 'https://api.alphogen.com'}/webhooks/test" \\
  -H "X-Webhook-Secret: YOUR_WEBHOOK_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{"test": true, "timestamp": "${new Date().toISOString()}"}'`
    
    navigator.clipboard.writeText(curl)
    toast.success('Commande cURL copiée')
  }

  const copyResponse = (response) => {
    navigator.clipboard.writeText(JSON.stringify(response, null, 2))
    toast.success('Réponse copiée')
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Test des Webhooks</h1>
          
          <div className="bg-white shadow rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Tester le webhook</h2>
            
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Testez l'endpoint webhook pour vérifier que l'authentification et le traitement fonctionnent correctement.
              </p>
              
              <div className="flex space-x-4">
                <button
                  onClick={handleTestWebhook}
                  disabled={loading}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-md text-sm font-medium"
                >
                  {loading ? 'Test en cours...' : 'Envoyer Test Webhook'}
                </button>
                
                <button
                  onClick={copyCurlWebhook}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-md text-sm font-medium"
                >
                  Copier cURL
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Historique des tests</h2>
            
            {testResults.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Aucun test effectué pour le moment</p>
            ) : (
              <div className="space-y-4">
                {testResults.map((result) => (
                  <div key={result.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className={`w-3 h-3 rounded-full ${
                          result.success ? 'bg-green-500' : 'bg-red-500'
                        }`}></span>
                        <span className="font-medium text-gray-900">
                          Test #{result.id}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {result.status}
                        </span>
                      </div>
                      
                      <div className="flex space-x-2">
                        <button
                          onClick={() => copyResponse(result.response)}
                          className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-xs font-medium"
                        >
                          Copier réponse
                        </button>
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-500 mb-3">
                      {new Date(result.timestamp).toLocaleString('fr-FR')}
                    </p>
                    
                    <div className="bg-gray-50 rounded-md p-3">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Réponse:</h4>
                      <pre className="text-xs text-gray-600 overflow-x-auto">
                        {JSON.stringify(result.response, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">Exemple cURL</h3>
            <div className="text-sm">
              <strong>Test webhook:</strong>
              <code className="block bg-white p-2 rounded mt-1 text-xs">
                {`curl -X POST "https://api.alphogen.com/webhooks/test" -H "X-Webhook-Secret: YOUR_SECRET" -H "Content-Type: application/json" -d '{"test": true}'`}
              </code>
            </div>
          </div>

          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-medium text-yellow-900 mb-2">Configuration requise</h3>
            <p className="text-yellow-800 text-sm">
              Pour que les webhooks fonctionnent, assurez-vous que la variable d'environnement 
              <code className="bg-yellow-100 px-1 rounded">WEBHOOK_SECRET</code> est configurée dans le Worker.
              Le secret doit être passé dans le header <code className="bg-yellow-100 px-1 rounded">X-Webhook-Secret</code>.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  )
}
