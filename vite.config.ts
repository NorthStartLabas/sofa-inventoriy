import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves this repo at https://northstartlabas.github.io/sofa-inventoriy/
// so every asset URL has to be prefixed with the repo name.
export default defineConfig({
  base: '/sofa-inventoriy/',
  plugins: [react(), tailwindcss()],
})
