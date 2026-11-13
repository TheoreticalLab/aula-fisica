/**
 * Arnés de la calculadora (solo desarrollo, no forma parte de la compilación):
 *   ./node_modules/.bin/vite --config pruebas/calculadora/vite.config.ts --port 5199
 *   http://127.0.0.1:5199/pruebas/calculadora/            (pantalla grande)
 *   http://127.0.0.1:5199/pruebas/calculadora/?movil=1    (comprobaciones de pantalla pequeña)
 * Usa los componentes reales (Calculadora, CalculadoraPanel, useVigilanciaSalida); solo la sesión es ficticia.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const raiz = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig({
  root: raiz,
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@/auth/AuthContext', replacement: fileURLToPath(new URL('./auth-falso.tsx', import.meta.url)) },
      { find: '@calif', replacement: fileURLToPath(new URL('../../supabase/functions/_shared/calificacion', import.meta.url)) },
      { find: '@', replacement: fileURLToPath(new URL('../../src', import.meta.url)) },
    ],
  },
  optimizeDeps: { entries: ['pruebas/calculadora/index.html'] },
  server: { host: '127.0.0.1', strictPort: true },
});
