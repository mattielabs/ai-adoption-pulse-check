import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * The client is a plain SPA. It is built into `dist/client`, which the Cloudflare
 * Worker serves as static assets (see wrangler.jsonc). There is no SSR and no
 * second application.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // During `npm run dev` the API is served by `wrangler dev` on 8787.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
});
