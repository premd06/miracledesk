import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // so fetch('/api/...') works in dev without a full url
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
