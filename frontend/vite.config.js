import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// The site is several separate apps under their own paths (see src/portal.js):
//   /          portal chooser (+ redirects for old links)
//   /student   /staff   /gate
//   /developer developer console — dev server only, never in a production build
const PUBLIC_PORTALS = ['student', 'staff', 'gate']
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

// Page URLs like /staff/admin/students load that portal's index.html; the
// portal's router takes it from there.
const portalPages = ({ withDeveloper }) => (req, res, next) => {
  const accept = req.headers.accept || ''
  const path = (req.url || '').split('?')[0]
  if (req.method !== 'GET' || !accept.includes('text/html') || /\.[a-z0-9]+$/i.test(path)) return next()
  const seg = path.split('/')[1]
  if (seg === 'developer' && withDeveloper) {
    // The console is for this computer only, even when the dev server is
    // reachable from the Wi-Fi.
    if (!LOOPBACK.has(req.socket.remoteAddress)) {
      res.statusCode = 404
      return res.end('Not found')
    }
    req.url = '/developer/index.html'
  } else if (PUBLIC_PORTALS.includes(seg)) {
    req.url = `/${seg}/index.html`
  } else {
    req.url = '/index.html'
  }
  next()
}

const portalRouting = () => ({
  name: 'hostelms-portal-routing',
  configureServer(server) {
    server.middlewares.use(portalPages({ withDeveloper: true }))
  },
  configurePreviewServer(server) {
    server.middlewares.use(portalPages({ withDeveloper: false }))
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), portalRouting()],
  appType: 'mpa',
  server: {
    // Listen on every address, so the site opens at localhost, 127.0.0.1 and
    // from phones on the same Wi-Fi (e.g. security scanning QR codes).
    host: true,
    port: 5173,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        ...Object.fromEntries(PUBLIC_PORTALS.map((p) => [p, resolve(import.meta.dirname, p, 'index.html')])),
      },
    },
  },
})
