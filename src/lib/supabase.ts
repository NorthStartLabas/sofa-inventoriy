import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill it in.',
  )
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // We consume the magic-link fragment ourselves in consumeAuthFromUrl(),
    // before the router mounts — HashRouter and Supabase both want the hash.
    detectSessionInUrl: false,
  },
})

/** Where Supabase should send people back to after they tap the magic link. */
export function redirectUrl(): string {
  return window.location.origin + import.meta.env.BASE_URL
}
