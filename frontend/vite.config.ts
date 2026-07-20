import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // SWA CLI runs on port 4280 and proxies both the frontend and /api/* to
    // the managed function runtime. Do NOT run `vite dev` directly for local
    // SWA testing — use `swa start` instead (see README-SWA.md).
    // The proxy block has been removed: SWA CLI owns that responsibility.
    host: '127.0.0.1',
    port: 3000,
  },
  build: {
    outDir: 'dist',
  },
})
