import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const smartBuyTarget = env.VITE_SMARTBUY_API_URL || 'http://localhost:5000'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api/smartbuy': {
          target: smartBuyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/smartbuy/, '/api'),
        },
        '/api': 'http://localhost:3001',
      },
    },
  }
})
