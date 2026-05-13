import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Aggressive service worker update path. Combined with `skipWaiting` +
// `clientsClaim` + `cleanupOutdatedCaches` in vite.config.ts and a no-cache
// header on sw.js, this caps the stale-bundle window for any test user at
// one page load. Stuck users only need to refresh once for the fix to land.
//
// An identical fallback runs from an inline script in index.html so the
// update path keeps working even if this bundle is itself stale or fails
// to load.
if ('serviceWorker' in navigator) {
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  })
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        reg.update().catch(() => undefined)
        window.setInterval(() => {
          reg.update().catch(() => undefined)
        }, 60_000)
      })
      .catch(() => undefined)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
