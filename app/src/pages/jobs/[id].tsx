import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Download, RefreshCw, Clock, CheckCircle, XCircle, ArrowLeft } from 'lucide-react'
import { api, Job } from '@/lib/api'

export default function JobDetail() {
  const router = useRouter()
  const { id } = router.query
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return

    const token = localStorage.getItem('auth_token')
    if (!token) {
      router.push('/login')
      return
    }

    fetchJob()
    
    const interval = setInterval(() => {
      if (job?.status === 'queued' || job?.status === 'processing') {
        fetchJob()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [id, job?.status])

  const fetchJob = async () => {
    try {
      const response = await api.getJob(id as string)
      setJob(response.job)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch job')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    if (!job?.result_url) return
    
    try {
      const url = await api.getAssetUrl(job.result_url)
      window.open(url, '_blank')
    } catch (err) {
      setError('Failed to download video')
    }
  }

  const getStatusDisplay = () => {
    if (!job) return null

    switch (job.status) {
      case 'queued':
        return (
          <div className="flex items-center space-x-2 text-yellow-500">
            <Clock className="h-5 w-5" />
            <span>Queued for processing</span>
          </div>
        )
      case 'processing':
        return (
          <div className="flex items-center space-x-2 text-blue-500">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>Generating your video...</span>
          </div>
        )
      case 'completed':
        return (
          <div className="flex items-center space-x-2 text-green-500">
            <CheckCircle className="h-5 w-5" />
            <span>Video completed successfully!</span>
          </div>
        )
      case 'failed':
        return (
          <div className="flex items-center space-x-2 text-red-500">
            <XCircle className="h-5 w-5" />
            <span>Video generation failed</span>
          </div>
        )
    }
  }

  if (loading) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-400">Loading job details...</p>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="text-center">
        <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Error</h1>
        <p className="text-gray-400 mb-6">{error || 'Job not found'}</p>
        <button onClick={() => router.push('/dashboard')} className="btn-primary">
          Back to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => router.push('/dashboard')}
        className="flex items-center space-x-2 text-gray-400 hover:text-white mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Dashboard</span>
      </button>

      <div className="card">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">Video Generation Job</h1>
            <p className="text-gray-400">
              Created {new Date(job.created_at).toLocaleString()}
            </p>
          </div>
          {getStatusDisplay()}
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Prompt</h2>
          <div className="bg-gray-800 p-4 rounded-lg">
            <p className="text-gray-300">{job.prompt}</p>
          </div>
        </div>

        {job.error_message && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2 text-red-400">Error Details</h2>
            <div className="bg-red-900 border border-red-700 p-4 rounded-lg">
              <p className="text-red-100">{job.error_message}</p>
            </div>
          </div>
        )}

        {job.status === 'processing' && (
          <div className="mb-6">
            <div className="bg-blue-900 border border-blue-700 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Processing Steps:</h3>
              <ul className="space-y-1 text-sm">
                <li>✓ Analyzing your prompt</li>
                <li>✓ Generating video scenes with WAN 2.2+</li>
                <li>🔄 Creating narration with Qwen-TTS</li>
                <li>⏳ Combining video, audio, and subtitles</li>
                <li>⏳ Uploading final video</li>
              </ul>
            </div>
          </div>
        )}

        {job.result_url && job.status === 'completed' && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-4">Your Video is Ready!</h2>
            <div className="bg-green-900 border border-green-700 p-6 rounded-lg text-center">
              <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
              <p className="text-green-100 mb-4">
                Your video has been generated successfully and is ready for download.
              </p>
              <button
                onClick={handleDownload}
                className="btn-primary flex items-center space-x-2 mx-auto"
              >
                <Download className="h-4 w-4" />
                <span>Download Video</span>
              </button>
            </div>
          </div>
        )}

        {(job.status === 'queued' || job.status === 'processing') && (
          <div className="text-center">
            <p className="text-gray-400 mb-4">
              This page will automatically update when your video is ready.
            </p>
            <button
              onClick={fetchJob}
              className="btn-secondary flex items-center space-x-2 mx-auto"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh Status</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
