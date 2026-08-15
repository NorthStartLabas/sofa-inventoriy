import { supabase } from './supabase'

export type AuthCallbackResult = {
  error: string | null
  /**
   * The link was a password reset, so the session it just created is a licence
   * to choose a new password and nothing else. Sign-in is email + password now;
   * this is the one remaining path that comes back through the URL.
   */
  recovery: boolean
}

/**
 * Supabase's emailed links come back as `#access_token=...&refresh_token=...`,
 * which is the same slot HashRouter uses for its route. So we read it here,
 * hand the tokens to Supabase, and rewrite the hash to `#/` — all before
 * React mounts, so the router never sees the token as a path.
 */
export async function consumeAuthFromUrl(): Promise<AuthCallbackResult> {
  const raw = window.location.hash.replace(/^#\/?/, '')
  if (!raw.includes('access_token=') && !raw.includes('error=')) {
    return { error: null, recovery: false }
  }

  const params = new URLSearchParams(raw)
  const recovery = params.get('type') === 'recovery'
  const clearHash = () =>
    window.history.replaceState(null, '', window.location.pathname + window.location.search + '#/')

  const errorDescription = params.get('error_description')
  if (errorDescription) {
    clearHash()
    // Expired links are the common case here, so say that rather than the raw code.
    return { error: errorDescription.replace(/\+/g, ' '), recovery: false }
  }

  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')
  if (!access_token || !refresh_token) {
    clearHash()
    return { error: 'That link was incomplete. Ask for a new one.', recovery: false }
  }

  const { error } = await supabase.auth.setSession({ access_token, refresh_token })
  clearHash()
  return { error: error ? error.message : null, recovery: recovery && !error }
}
