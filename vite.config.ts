import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3200,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3201',
      },
      '/ws': {
        target: 'ws://localhost:3201',
        ws: true,
      },
    },
  },
})
