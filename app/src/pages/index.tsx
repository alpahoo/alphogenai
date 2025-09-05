import Link from 'next/link'
import { Video, Zap, Download, Users } from 'lucide-react'

export default function Home() {
  return (
    <div className="text-center">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Generate Amazing Videos with AI
        </h1>
        <p className="text-xl text-gray-300 mb-8">
          Transform your text prompts into stunning 90-second videos with narration and background music.
          Powered by cutting-edge AI technology.
        </p>

        <div className="flex justify-center space-x-4 mb-12">
          <Link href="/signup" className="btn-primary text-lg px-8 py-3">
            Get Started Free
          </Link>
          <Link href="/login" className="btn-secondary text-lg px-8 py-3">
            Sign In
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <div className="card text-center">
            <Zap className="h-12 w-12 text-blue-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">AI-Powered Generation</h3>
            <p className="text-gray-400">
              Advanced WAN 2.2+ technology creates high-quality videos from your text descriptions.
            </p>
          </div>

          <div className="card text-center">
            <Video className="h-12 w-12 text-purple-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Complete Production</h3>
            <p className="text-gray-400">
              Automatic narration, subtitles, and background music for professional results.
            </p>
          </div>

          <div className="card text-center">
            <Download className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Easy Download</h3>
            <p className="text-gray-400">
              Download your videos in high quality and share them anywhere you want.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
