import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Web circle berbicara ke API Ekosistem (satu database). Di lokal: proxy /api → server Ekosistem :3001, sehingga
// cookie refresh-token tetap same-origin. Header X-Unit-Web memilih "etalase" circle (di production
// header ini diatur nginx per alamat: bloom.domain-anda.com → bloom). Contoh: VITE_CIRCLE=naya npm run dev
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const circle = env.VITE_CIRCLE || 'bloom'
  return {
    plugins: [react()],
    server: {
      port: Number(env.VITE_PORT) || 5174,
      proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true, headers: { 'X-Unit-Web': circle } } },
    },
  }
})
