// Custom replacement for the auto-generated registerSW.js. Kept in public/
// instead of letting vite-plugin-pwa inject its own, because previous deploys'
// auto-injected version sat in Cloudflare's edge cache for the custom domain
// and didn't include the controllerchange → reload path. Putting a real file
// here means every deploy ships an up-to-date copy.
//
// Behavior:
// - Registers /sw.js on page load.
// - Reloads the page whenever a new service worker takes control.
// - Forces a registration update on load and every 60s while open.
//
// Mirrors the inline script in index.html and the registration code in
// main.tsx; this file exists so users on previous-deploy cached HTML (which
// references /registerSW.js) also get the new behavior.
if ('serviceWorker' in navigator) {
  var reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
  window.addEventListener('load', function () {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(function (reg) {
        reg.update().catch(function () {});
        setInterval(function () {
          reg.update().catch(function () {});
        }, 60000);
      })
      .catch(function () {});
  });
}
