import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/playground': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/v1/migrations': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  }
})
