import { ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { LogOut, Video, Home, Plus, User } from 'lucide-react'
import { api } from '@/lib/api'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    setIsAuthenticated(!!token)
  }, [])

  const handleLogout = () => {
    api.clearToken()
    setIsAuthenticated(false)
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <nav className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-2">
                <Video className="h-8 w-8 text-blue-500" />
                <span className="text-xl font-bold">AlphoGenAI</span>
              </Link>
            </div>

            {isAuthenticated && (
              <div className="flex items-center space-x-4">
                <Link href="/dashboard" className="flex items-center space-x-1 hover:text-blue-400">
                  <Home className="h-4 w-4" />
                  <span>Dashboard</span>
                </Link>
                <Link href="/create" className="flex items-center space-x-1 hover:text-blue-400">
                  <Plus className="h-4 w-4" />
                  <span>Create</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1 hover:text-red-400"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            )}

            {!isAuthenticated && (
              <div className="flex items-center space-x-4">
                <Link href="/login" className="hover:text-blue-400">
                  Login
                </Link>
                <Link href="/signup" className="btn-primary">
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
