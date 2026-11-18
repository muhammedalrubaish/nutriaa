const { execSync } = require('node:child_process')

// Build/deploy id baked into the client bundle; /api/app-version returns the same value at runtime,
// so open tabs can tell when a newer deploy is live (lib/useAppUpdate.js).
function appVersion() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'dev'
  }
}

/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: { NEXT_PUBLIC_APP_VERSION: appVersion() },
  async headers() {
    return [
      // HTML pages: always revalidate so a reopened tab/PWA never shows a stale build.
      {
        source: '/((?!_next/static|_next/image|api|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?|css|js|json|webmanifest)$).*)',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] },
    ]
  },
}
