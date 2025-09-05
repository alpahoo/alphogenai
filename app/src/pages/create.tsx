import { useState } from 'react'
import { useRouter } from 'next/router'
import { Video, Wand2 } from 'lucide-react'
import { api } from '@/lib/api'

export default function Create() {
  const router = useRouter()
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await api.createJob(prompt)
      router.push(`/jobs/${response.job.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create video job')
    } finally {
      setLoading(false)
    }
  }

  const examplePrompts = [
    "A serene mountain landscape at sunrise with birds flying overhead",
    "A bustling city street with people walking and cars passing by",
    "An underwater scene with colorful fish swimming around coral reefs",
    "A cozy coffee shop with steam rising from fresh coffee cups",
    "A space station orbiting Earth with astronauts working outside"
  ]

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <Video className="h-16 w-16 text-blue-500 mx-auto mb-4" />
        <h1 className="text-3xl font-bold mb-2">Create Your Video</h1>
        <p className="text-gray-400">
          Describe what you want to see and our AI will generate a stunning 90-second video for you.
        </p>
      </div>

      <div className="card">
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium mb-2">
              Video Description
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the video you want to create..."
              className="input-field w-full h-32 resize-none"
              required
            />
            <p className="text-sm text-gray-400 mt-2">
              Be descriptive! Include details about the scene, mood, colors, and any specific elements you want.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="btn-primary w-full flex items-center justify-center space-x-2"
          >
            <Wand2 className="h-4 w-4" />
            <span>{loading ? 'Creating Video...' : 'Generate Video'}</span>
          </button>
        </form>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Example Prompts</h2>
        <div className="space-y-2">
          {examplePrompts.map((example, index) => (
            <button
              key={index}
              onClick={() => setPrompt(example)}
              className="text-left w-full p-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
