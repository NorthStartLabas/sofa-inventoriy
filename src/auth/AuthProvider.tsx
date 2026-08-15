import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { redirectUrl, supabase } from '../lib/supabase'
import { consumeAuthFromUrl } from '../lib/authCallback'
import { AuthContext, type AuthValue } from './authContext'

/**
 * Says what a person standing in a kitchen needs to hear, rather than what
 * GoTrue says.
 */
function readable(message: string): string {
  if (/invalid login credentials/i.test(message)) {
    return 'That email and password don’t match. Check both, or reset the password.'
  }
  if (/email not confirmed/i.test(message)) {
    return 'That account hasn’t been confirmed yet. Ask Liviu to finish setting it up.'
  }
  if (/signups? not allowed|not authorized/i.test(message)) {
    return 'That email doesn’t have an account here. Ask Liviu to make one.'
  }
  if (/rate limit|too many requests/i.test(message)) {
    return 'Too many tries. Wait a minute and go again.'
  }
  if (/password should be at least|weak password/i.test(message)) {
    return 'That password is too short — use at least 8 characters.'
  }
  if (/same as the old password|different from the old/i.test(message)) {
    return 'That’s the password you already have. Pick a different one.'
  }
  return message
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [callbackError, setCallbackError] = useState<string | null>(null)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    let active = true

    void (async () => {
      try {
        // A reset link's fragment has to be consumed before we ask for the
        // session, otherwise the first read comes back empty and we flash the
        // sign-in screen.
        const { error, recovery } = await consumeAuthFromUrl()
        if (active && error) setCallbackError(readable(error))
        if (active && recovery) setRecovering(true)

        const { data } = await supabase.auth.getSession()
        if (active) setSession(data.session)
      } catch {
        // Without this the whole app sits on "Loading…" forever: setLoading
        // used to live inside the promise chain, so a dropped connection here
        // meant it never ran. Kitchen wifi makes that a real state.
        if (active) setCallbackError('Could not reach the server. Check the connection and reload.')
      } finally {
        if (active) setLoading(false)
      }
    })()

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return
      // Fires when a reset link is opened in a tab that was already running,
      // so the gate has to react to it here too, not only on first load.
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'SIGNED_OUT') setRecovering(false)
      setSession(next)
      setLoading(false)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return { error: readable(error.message) }
    // Only now: until Supabase has accepted it, they still need this screen.
    setRecovering(false)
    return { error: null }
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      session,
      loading,
      callbackError,
      recovering,
      signIn: async (email: string, password: string) => {
        setCallbackError(null)
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        return { error: error ? readable(error.message) : null }
      },
      // Registration is closed, so this is also the only way an account can be
      // recovered without the owner: Supabase sends nothing to an address it
      // doesn't know, and reports success either way so the form can't be used
      // to find out which addresses exist.
      sendPasswordReset: async (email: string) => {
        setCallbackError(null)
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: redirectUrl(),
        })
        return { error: error ? readable(error.message) : null }
      },
      updatePassword,
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [session, loading, callbackError, recovering, updatePassword],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
