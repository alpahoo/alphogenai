import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { Plus, Video, Clock, CheckCircle, XCircle } from 'lucide-react'
import { api, Job } from '@/lib/api'

export default function Dashboard() {
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      router.push('/login')
      return
    }

    fetchJobs()
  }, [])

  const fetchJobs = async () => {
    try {
      const response = await api.getJobs()
      setJobs(response.jobs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs')
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued':
        return <Clock className="h-5 w-5 text-yellow-500" />
      case 'processing':
        return <Clock className="h-5 w-5 text-blue-500 animate-spin" />
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <Clock className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'queued':
        return 'text-yellow-500'
      case 'processing':
        return 'text-blue-500'
      case 'completed':
        return 'text-green-500'
      case 'failed':
        return 'text-red-500'
      default:
        return 'text-gray-500'
    }
  }

  if (loading) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-400">Loading your videos...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Your Videos</h1>
        <Link href="/create" className="btn-primary flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>Create New Video</span>
        </Link>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="text-center py-12">
          <Video className="h-24 w-24 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No videos yet</h2>
          <p className="text-gray-400 mb-6">Create your first AI-generated video to get started!</p>
          <Link href="/create" className="btn-primary">
            Create Your First Video
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <Link key={job.id} href={`/jobs/${job.id}`}>
              <div className="card hover:bg-gray-750 transition-colors cursor-pointer">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(job.status)}
                    <span className={`font-medium capitalize ${getStatusColor(job.status)}`}>
                      {job.status}
                    </span>
                  </div>
                  <span className="text-sm text-gray-400">
                    {new Date(job.created_at).toLocaleDateString()}
                  </span>
                </div>
                
                <h3 className="font-semibold mb-2 line-clamp-2">
                  {job.prompt.length > 60 ? `${job.prompt.substring(0, 60)}...` : job.prompt}
                </h3>
                
                {job.error_message && (
                  <p className="text-red-400 text-sm">{job.error_message}</p>
                )}
                
                {job.result_url && (
                  <div className="mt-3 pt-3 border-t border-gray-600">
                    <span className="text-green-400 text-sm">✓ Video ready for download</span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
