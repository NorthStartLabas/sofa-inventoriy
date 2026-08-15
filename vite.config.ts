import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves this repo at https://northstartlabas.github.io/sofa-inventoriy/
// so every asset URL has to be prefixed with the repo name.
const base = '/sofa-inventoriy/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // The kitchen never opens a store to update anything, so a new deploy has
      // to arrive on its own — but it should arrive at a moment nobody is
      // mid-tap. 'prompt' makes a new version wait instead of seizing the page;
      // src/lib/serviceWorker.ts decides when to take it (next time the phone
      // comes out of a pocket) and, just as importantly, actually goes looking
      // for one. 'autoUpdate' plus the injected registration did neither: a
      // home-screen app is never navigated, so it never checked at all.
      registerType: 'prompt',
      // We register from src/lib/serviceWorker.ts. Without this the plugin also
      // injects its own <script>, and the app registers twice.
      injectRegister: null,
      manifest: {
        name: 'SOFA Kitchen orders',
        short_name: 'Kitchen',
        description: 'Ingredient ordering for the kitchen.',
        start_url: base,
        scope: base,
        display: 'standalone',
        // No `orientation` lock. It was 'portrait', which is right for a phone
        // and wrong for the tablet the two-pane layout exists for — an installed
        // iPad could never have turned sideways to reach it.
        // Matches the top of ScreenHeader's gradient, so the status bar continues
        // instead of interrupting it.
        theme_color: '#8a3949',
        background_color: '#f5f0e8',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          // The mark sits inside the central 60%, so cropping to a circle or a
          // squircle can't cut it.
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Under the base path, not at the root — Pages serves nothing at /.
        navigateFallback: `${base}index.html`,
        // Supabase is a different origin and must always go to the network:
        // a cached basket is exactly the bug the retry queue exists to avoid.
        navigateFallbackDenylist: [/^\/api/, /supabase\.co/],
        globPatterns: ['**/*.{js,css,html,woff,woff2,png,svg}'],
      },
    }),
  ],
})
