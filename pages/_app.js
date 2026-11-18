import { useEffect } from 'react'
import '@/styles/globals.css'
import Footer from '@/components/Footer'

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])
  return (
    <>
      <Component {...pageProps} />
      <Footer />
    </>
  )
}
