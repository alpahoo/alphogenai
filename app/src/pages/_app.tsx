import type { AppProps } from 'next/app'
import Layout from '@/components/Layout'
import '@/styles/globals.css'
import { useEffect } from 'react'

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    import('../lib/interceptor')
  }, [])

  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  )
}
