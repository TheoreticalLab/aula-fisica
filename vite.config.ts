import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// BASE_PATH: ruta de publicación en GitHub Pages, p. ej. «/aula-fisica/». En local, «/».
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@calif': fileURLToPath(new URL('./supabase/functions/_shared/calificacion', import.meta.url)),
    },
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          graficas: ['recharts'],
          matematicas: ['katex', 'react-markdown', 'remark-math', 'rehype-katex', 'remark-gfm'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
