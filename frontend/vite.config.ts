import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('vis-network') || id.includes('vis-data')) return 'graph-vendor'
          if (id.includes('node_modules/react')) return 'react-vendor'
          if (id.includes('node_modules/lucide-react')) return 'ui-vendor'
          return undefined
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 8080,
    watch: {
      usePolling: true
    }
  }
})
