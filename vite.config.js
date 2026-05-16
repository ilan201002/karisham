import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// P1-6: build-time version injection into service worker
// כל build מקבל timestamp ייחודי שמטריג refresh ב-PWA.
const buildVersion = new Date().toISOString().replace(/[:.]/g, '-')

const swVersionPlugin = () => {
  let outDir = 'dist'
  return {
    name: 'sw-version-injection',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      const swPath = resolve(outDir, 'sw.js')
      try {
        const sw = readFileSync(swPath, 'utf8')
        const updated = sw.replace(/__SW_VERSION__/g, buildVersion)
        writeFileSync(swPath, updated)
        console.log(`[sw-version] injected ${buildVersion} → ${swPath}`)
      } catch (e) {
        console.warn(`[sw-version] sw.js not found at ${swPath} — skipping`)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), swVersionPlugin()],
  build: {
    outDir: 'dist',
    // P1-5: chunk splitting להקטנת bundle הראשוני
    // טעינת sentry/supabase ב-chunks נפרדים → cache טוב יותר + parallel download
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('@sentry')) return 'sentry'
            if (id.includes('@supabase')) return 'supabase'
            if (id.includes('react')) return 'react'
            return 'vendor'
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  define: {
    '__SW_VERSION__': JSON.stringify(buildVersion),
  },
})
