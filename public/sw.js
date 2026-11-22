// Service Worker — Push Notifications
self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title || 'قسم خدمات التغذية', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'nutri-note',
      // Same tag + no renotify: the existing notification is updated silently instead of buzzing again.
      renotify: !!data.renotify,
      data: { url: data.url || '/' },
      dir: 'rtl',
      lang: 'ar',
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(url) && 'focus' in c) return c.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})

// The browser rotated or dropped the subscription (expiry, key change): subscribe again with the
// server's current key and store it, so the phone keeps receiving pushes without a manual toggle.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const r = await fetch('/api/push/vapid-key')
        if (!r.ok) return
        const { publicKey } = await r.json()
        const pad = '='.repeat((4 - (publicKey.length % 4)) % 4)
        const raw = atob((publicKey + pad).replace(/-/g, '+').replace(/_/g, '/'))
        const key = Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
        const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
        await fetch('/api/push/subscribe', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        })
      } catch {}
    })(),
  )
})

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()))
