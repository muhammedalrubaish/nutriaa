// Deploy id of the running server build. Open tabs poll this (lib/useAppUpdate.js) and reload
// themselves when it differs from the build they loaded. No auth; returns only the commit id.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const version = process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_APP_VERSION || ''
  return res.status(200).json({ version })
}
