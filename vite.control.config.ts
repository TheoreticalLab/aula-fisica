/**
 * Compilación de ORBE CONTROL (PWA del profesor), independiente del aula:
 *   vite build -c vite.control.config.ts   →  dist/control/   (publicada en <BASE_PATH>control/)
 * Genera además el Service Worker (sw.js) con una versión por compilación y añade en producción una política de
 * seguridad de contenido (CSP) que solo permite hablar con el propio sitio y con Supabase.
 */
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const raiz = fileURLToPath(new URL('.', import.meta.url));
const base = `${process.env.BASE_PATH ?? '/'}control/`;
const VERSION = new Date().toISOString().replace(/\D/g, '').slice(0, 14);

// Service Worker: solo la «cáscara» de la aplicación. NUNCA guarda respuestas de Supabase (otro origen),
// así que ningún dato de estudiantes queda en el caché del teléfono.
const SW = `/* Orbe Control · Service Worker ${VERSION} (generado al compilar) */
const CACHE = 'orbe-control-${VERSION}';
const CASCARA = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CASCARA)));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('orbe-control-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('message', (e) => {
  if (e.data === 'activar') self.skipWaiting();
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || !url.pathname.startsWith(new URL('./', self.registration.scope).pathname)) return;
  if (req.mode === 'navigate') {
    // red primero (siempre la versión publicada); sin red, la cáscara guardada
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }
  if (url.pathname.includes('/assets/')) {
    // archivos con huella en el nombre: inmutables
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((resp) => {
      if (resp.ok) { const copia = resp.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
      return resp;
    })));
  }
});
`;

function orbePwa(): Plugin {
  return {
    name: 'orbe-control-pwa',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: SW });
    },
    transformIndexHtml(html) {
      const supa = process.env.VITE_SUPABASE_URL ? new URL(process.env.VITE_SUPABASE_URL).host : '*.supabase.co';
      const csp = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        `connect-src 'self' https://${supa} wss://${supa}`,
        "manifest-src 'self'",
        "worker-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ].join('; ');
      return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />\n    <meta name="referrer" content="no-referrer" />`);
    },
  };
}

export default defineConfig({
  root: fileURLToPath(new URL('./orbe-control', import.meta.url)),
  envDir: raiz,
  base,
  plugins: [react(), orbePwa()],
  build: {
    outDir: fileURLToPath(new URL('./dist/control', import.meta.url)),
    emptyOutDir: true,
    sourcemap: false,
  },
});
