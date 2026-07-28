import { supabase } from './supabase'

export type AuthCallbackResult = { error: string | null }

/**
 * Supabase's magic link comes back as `#access_token=...&refresh_token=...`,
 * which is the same slot HashRouter uses for its route. So we read it here,
 * hand the tokens to Supabase, and rewrite the hash to `#/` — all before
 * React mounts, so the router never sees the token as a path.
 */
export async function consumeAuthFromUrl(): Promise<AuthCallbackResult> {
  const raw = window.location.hash.replace(/^#\/?/, '')
  if (!raw.includes('access_token=') && !raw.includes('error=')) {
    return { error: null }
  }

  const params = new URLSearchParams(raw)
  const clearHash = () =>
    window.history.replaceState(null, '', window.location.pathname + window.location.search + '#/')

  const errorDescription = params.get('error_description')
  if (errorDescription) {
    clearHash()
    // Expired links are the common case here, so say that rather than the raw code.
    return { error: errorDescription.replace(/\+/g, ' ') }
  }

  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')
  if (!access_token || !refresh_token) {
    clearHash()
    return { error: 'That sign-in link was incomplete. Ask for a new one.' }
  }

  const { error } = await supabase.auth.setSession({ access_token, refresh_token })
  clearHash()
  return { error: error ? error.message : null }
}
