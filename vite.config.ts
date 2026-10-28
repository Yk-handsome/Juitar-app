import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import fs from 'node:fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss(), {
    name: 'native-entry-copy',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'src/app.js', source: fs.readFileSync('src/app.js', 'utf8') })
      this.emitFile({ type: 'asset', fileName: 'assets/alphaTab.worker.mjs', source: fs.readFileSync('public/alphatab/alphaTab.worker.min.mjs', 'utf8') })
      this.emitFile({ type: 'asset', fileName: 'assets/alphaTab.worklet.mjs', source: fs.readFileSync('public/alphatab/alphaTab.worklet.min.mjs', 'utf8') })
    },
  }],
  base: process.env.VITE_BASE || '/',
})
