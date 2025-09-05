import { useState } from 'react'
import Layout from '../components/Layout'
import { api } from '../lib/api'
import toast from 'react-hot-toast'

export default function Jobs() {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [jobs, setJobs] = useState([])

  const handleCreateJob = async () => {
    if (!prompt.trim()) {
      toast.error('Veuillez entrer un prompt')
      return
    }

    setLoading(true)
    try {
      const response = await api.post('/jobs', { prompt })
      
      if (response.ok) {
        const newJob = {
          id: response.provider_job_id || `local-${Date.now()}`,
          prompt,
          status: response.status || 'submitted',
          provider: response.provider || 'noop',
          createdAt: new Date().toISOString(),
          message: response.message
        }
        
        setJobs(prev => [newJob, ...prev])
        setPrompt('')
        
        if (response.provider === 'noop') {
          toast.success('Job créé en mode noop (RunPod non configuré)')
        } else {
          toast.success('Job créé avec succès')
        }
      } else {
        toast.error('Erreur lors de la création du job')
      }
    } catch (error) {
      toast.error('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  const handleCheckStatus = async (jobId) => {
    if (jobId.startsWith('local-')) {
      toast.info('Job local - pas de statut RunPod disponible')
      return
    }

    try {
      const response = await api.get(`/jobs/${jobId}`)
      
      if (response.ok) {
        setJobs(prev => prev.map(job => 
          job.id === jobId 
            ? { ...job, status: response.status, lastChecked: new Date().toISOString() }
            : job
        ))
        toast.success('Statut mis à jour')
      } else {
        toast.error('Erreur lors de la vérification du statut')
      }
    } catch (error) {
      toast.error('Erreur de connexion')
    }
  }

  const copyCurlCreate = () => {
    const curl = `curl -X POST "${process.env.NEXT_PUBLIC_API_BASE || 'https://api.alphogen.com'}/jobs" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "${prompt || 'Your video prompt here'}"}'`
    
    navigator.clipboard.writeText(curl)
    toast.success('Commande cURL copiée')
  }

  const copyCurlStatus = (jobId) => {
    const curl = `curl "${process.env.NEXT_PUBLIC_API_BASE || 'https://api.alphogen.com'}/jobs/${jobId}" \\
  -H "Authorization: Bearer YOUR_TOKEN"`
    
    navigator.clipboard.writeText(curl)
    toast.success('Commande cURL copiée')
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Gestion des Jobs</h1>
          
          <div className="bg-white shadow rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Créer un nouveau job</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
                  Prompt pour la génération vidéo
                </label>
                <textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Décrivez la vidéo que vous souhaitez générer..."
                />
              </div>
              
              <div className="flex space-x-4">
                <button
                  onClick={handleCreateJob}
                  disabled={loading || !prompt.trim()}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-md text-sm font-medium"
                >
                  {loading ? 'Création en cours...' : 'Créer le Job'}
                </button>
                
                <button
                  onClick={copyCurlCreate}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-md text-sm font-medium"
                >
                  Copier cURL
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Historique des jobs</h2>
            
            {jobs.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Aucun job créé pour le moment</p>
            ) : (
              <div className="space-y-4">
                {jobs.map((job) => (
                  <div key={job.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="font-medium text-gray-900">Job #{job.id}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            job.status === 'completed' ? 'bg-green-100 text-green-800' :
                            job.status === 'running' ? 'bg-blue-100 text-blue-800' :
                            job.status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {job.status}
                          </span>
                          <span className="text-xs text-gray-500">
                            Provider: {job.provider}
                          </span>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-2">
                          <strong>Prompt:</strong> {job.prompt}
                        </p>
                        
                        {job.message && (
                          <p className="text-xs text-gray-500 mb-2">
                            <strong>Message:</strong> {job.message}
                          </p>
                        )}
                        
                        <p className="text-xs text-gray-500">
                          Créé le {new Date(job.createdAt).toLocaleString('fr-FR')}
                          {job.lastChecked && (
                            <span> • Dernière vérification: {new Date(job.lastChecked).toLocaleString('fr-FR')}</span>
                          )}
                        </p>
                      </div>
                      
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => handleCheckStatus(job.id)}
                          disabled={job.id.startsWith('local-')}
                          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-3 py-1 rounded text-xs font-medium"
                        >
                          Vérifier statut
                        </button>
                        <button
                          onClick={() => copyCurlStatus(job.id)}
                          className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-xs font-medium"
                        >
                          cURL
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">Exemples cURL</h3>
            <div className="space-y-2 text-sm">
              <div>
                <strong>Créer un job:</strong>
                <code className="block bg-white p-2 rounded mt-1 text-xs">
                  {`curl -X POST "https://api.alphogen.com/jobs" -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" -d '{"prompt": "A beautiful sunset over mountains"}'`}
                </code>
              </div>
              <div>
                <strong>Vérifier le statut:</strong>
                <code className="block bg-white p-2 rounded mt-1 text-xs">
                  curl "https://api.alphogen.com/jobs/JOB_ID" -H "Authorization: Bearer YOUR_TOKEN"
                </code>
              </div>
            </div>
          </div>

          {jobs.some(job => job.provider === 'noop') && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 text-sm">
                <strong>Mode noop détecté:</strong> RunPod n'est pas configuré. Les jobs sont créés en mode simulation.
                Pour activer la génération réelle, configurez RUNPOD_API_KEY et RUNPOD_ENDPOINT_ID.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
