import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import toast from 'react-hot-toast'

export default function Billing() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [subscription, setSubscription] = useState(null)

  useEffect(() => {
    checkUser()
    checkUrlParams()
  }, [])

  const checkUser = async () => {
    try {
      if (!supabase) {
        setLoading(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    } catch (error) {
      console.error('Error checking user:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkUrlParams = () => {
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('success') === 'true') {
      toast.success('Abonnement activé avec succès!')
    } else if (urlParams.get('canceled') === 'true') {
      toast.info('Abonnement annulé')
    }
  }

  const handleCheckout = async (priceId = 'price_default') => {
    if (!user) {
      toast.error('Veuillez vous connecter pour vous abonner')
      return
    }

    setCheckoutLoading(true)
    try {
      const response = await api.post('/billing/checkout', {
        price_id: priceId,
        success_url: `${window.location.origin}/billing?success=true`,
        cancel_url: `${window.location.origin}/billing?canceled=true`
      }, {
        headers: {
          'Authorization': `Bearer ${user.access_token}`
        }
      })

      if (response.ok && response.checkout_url) {
        window.location.href = response.checkout_url
      } else if (response.provider === 'noop') {
        toast.info('Billing en mode noop (Stripe non configuré)')
      } else {
        toast.error('Erreur lors de la création de la session de paiement')
      }
    } catch (error) {
      toast.error('Erreur de connexion')
    } finally {
      setCheckoutLoading(false)
    }
  }

  const copyCurlCheckout = () => {
    const token = user?.access_token || 'YOUR_JWT_TOKEN'
    const curl = `curl -X POST "${process.env.NEXT_PUBLIC_API_BASE || 'https://api.alphogen.com'}/billing/checkout" \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "price_id": "price_default",
    "success_url": "https://yourapp.com/billing?success=true",
    "cancel_url": "https://yourapp.com/billing?canceled=true"
  }'`
    
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
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Facturation</h1>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h2 className="text-lg font-medium text-yellow-900 mb-2">
                  Authentification requise
                </h2>
                <p className="text-yellow-800">
                  Pour accéder à la facturation, configurez d'abord l'authentification Supabase.
                </p>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Facturation & Abonnements</h1>
          
          {!user ? (
            <div className="bg-white shadow rounded-lg p-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Connexion requise</h2>
                <p className="text-gray-600 mb-6">
                  Veuillez vous connecter pour accéder aux options de facturation.
                </p>
                <a
                  href="/account"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md text-sm font-medium"
                >
                  Se connecter
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Plans d'abonnement</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Plan Gratuit</h3>
                    <p className="text-3xl font-bold text-gray-900 mb-4">0€<span className="text-sm font-normal text-gray-500">/mois</span></p>
                    <ul className="space-y-2 text-sm text-gray-600 mb-6">
                      <li>• 5 générations par mois</li>
                      <li>• Qualité standard</li>
                      <li>• Support communautaire</li>
                    </ul>
                    <button
                      disabled
                      className="w-full bg-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium cursor-not-allowed"
                    >
                      Plan actuel
                    </button>
                  </div>

                  <div className="border-2 border-blue-500 rounded-lg p-6 relative">
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                        Recommandé
                      </span>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Plan Pro</h3>
                    <p className="text-3xl font-bold text-gray-900 mb-4">29€<span className="text-sm font-normal text-gray-500">/mois</span></p>
                    <ul className="space-y-2 text-sm text-gray-600 mb-6">
                      <li>• 100 générations par mois</li>
                      <li>• Qualité HD</li>
                      <li>• Support prioritaire</li>
                      <li>• API access</li>
                    </ul>
                    <button
                      onClick={() => handleCheckout('price_pro_monthly')}
                      disabled={checkoutLoading}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium"
                    >
                      {checkoutLoading ? 'Chargement...' : 'S\'abonner'}
                    </button>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Plan Enterprise</h3>
                    <p className="text-3xl font-bold text-gray-900 mb-4">99€<span className="text-sm font-normal text-gray-500">/mois</span></p>
                    <ul className="space-y-2 text-sm text-gray-600 mb-6">
                      <li>• Générations illimitées</li>
                      <li>• Qualité 4K</li>
                      <li>• Support dédié</li>
                      <li>• API illimitée</li>
                      <li>• Intégrations custom</li>
                    </ul>
                    <button
                      onClick={() => handleCheckout('price_enterprise_monthly')}
                      disabled={checkoutLoading}
                      className="w-full bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium"
                    >
                      {checkoutLoading ? 'Chargement...' : 'S\'abonner'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Gestion de l'abonnement</h2>
                  <button
                    onClick={copyCurlCheckout}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    Copier cURL
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-md p-4">
                    <h3 className="font-medium text-gray-900 mb-2">Statut actuel</h3>
                    <p className="text-sm text-gray-600">
                      Plan gratuit • Aucun abonnement actif
                    </p>
                  </div>
                  
                  <div className="flex space-x-4">
                    <button
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                      onClick={() => toast.info('Portail client Stripe non implémenté dans cette démo')}
                    >
                      Gérer l'abonnement
                    </button>
                    <button
                      className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                      onClick={() => toast.info('Téléchargement des factures non implémenté dans cette démo')}
                    >
                      Télécharger les factures
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">Exemple cURL</h3>
            <div className="text-sm">
              <strong>Créer une session de checkout:</strong>
              <code className="block bg-white p-2 rounded mt-1 text-xs">
                {`curl -X POST "https://api.alphogen.com/billing/checkout" -H "Authorization: Bearer YOUR_JWT" -H "Content-Type: application/json" -d '{"price_id": "price_pro_monthly"}'`}
              </code>
            </div>
          </div>

          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-medium text-yellow-900 mb-2">Configuration Stripe</h3>
            <p className="text-yellow-800 text-sm">
              Pour activer les paiements, configurez les variables d'environnement:
            </p>
            <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside">
              <li><code>STRIPE_SECRET_KEY</code> - Clé secrète Stripe</li>
              <li><code>STRIPE_WEBHOOK_SECRET</code> - Secret webhook Stripe</li>
            </ul>
            <p className="text-yellow-800 text-sm mt-2">
              Sans ces variables, l'API retournera des réponses "noop" pour les endpoints de facturation.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  )
}
