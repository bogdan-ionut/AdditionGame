import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IMPORTANT: Using a relative base makes all built asset URLs resolve under
// the current folder (…/AdditionGame/). This fixes 404s on GitHub Pages.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  }
})
