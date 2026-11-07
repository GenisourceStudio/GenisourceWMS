import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The dev server proxies API calls to Spring Boot so the browser sees a single
// origin. In production Nginx does the same job (deploy/nginx/default.conf).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    proxy: {
      '/api': { target: 'http://localhost:8101', changeOrigin: true },
      '/actuator': { target: 'http://localhost:8101', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
