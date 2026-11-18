import { useEffect } from 'react'
import '@/styles/globals.css'
import Footer from '@/components/Footer'
import { useAppUpdate } from '@/lib/useAppUpdate'

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])
  const updatePending = useAppUpdate()
  return (
    <>
      {updatePending && (
        <div
          dir="rtl"
          role="status"
          className="print:hidden fixed top-2 left-1/2 -translate-x-1/2 z-[1000] rounded-lg bg-emerald-700 text-white text-sm px-4 py-2 shadow-lg"
        >
          يوجد تحديث جديد، سيتم التحديث تلقائيًا
        </div>
      )}
      <Component {...pageProps} />
      <Footer />
    </>
  )
}
