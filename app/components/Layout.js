import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import toast, { Toaster } from 'react-hot-toast'

export default function Layout({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false)
      return
    }

    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    if (!isSupabaseConfigured()) return
    
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('Erreur lors de la déconnexion')
    } else {
      toast.success('Déconnecté avec succès')
      router.push('/')
    }
  }

  const navigation = [
    { name: 'Dashboard', href: '/' },
    { name: 'Assets', href: '/assets' },
    { name: 'Jobs', href: '/jobs' },
    { name: 'Webhooks', href: '/webhooks' },
    { name: 'Account', href: '/account' },
    { name: 'Billing', href: '/billing' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link href="/" className="text-xl font-bold text-gray-900">
                  AlphoGenAI
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`${
                      router.pathname === item.href
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center">
              {!loading && (
                <>
                  {isSupabaseConfigured() ? (
                    user ? (
                      <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-700">{user.email}</span>
                        <button
                          onClick={handleSignOut}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-sm font-medium"
                        >
                          Déconnexion
                        </button>
                      </div>
                    ) : (
                      <Link
                        href="/account"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium"
                      >
                        Connexion
                      </Link>
                    )
                  ) : (
                    <span className="text-sm text-gray-500">Auth non configurée</span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          className: '',
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            className: 'toast-success',
          },
          error: {
            className: 'toast-error',
          },
        }}
      />
    </div>
  )
}
