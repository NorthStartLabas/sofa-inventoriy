import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { redirectUrl, supabase } from '../lib/supabase'
import { consumeAuthFromUrl } from '../lib/authCallback'
import { AuthContext, type AuthValue } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [callbackError, setCallbackError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    void (async () => {
      try {
        // The magic-link fragment has to be consumed before we ask for the
        // session, otherwise the first read comes back empty and we flash the
        // sign-in screen.
        const { error } = await consumeAuthFromUrl()
        if (active && error) setCallbackError(error)

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

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return
      setSession(next)
      setLoading(false)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      session,
      loading,
      callbackError,
      sendMagicLink: async (email: string) => {
        setCallbackError(null)
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            emailRedirectTo: redirectUrl(),
            // Open on purpose: an unknown address gets an account rather than a
            // refusal, so new people can register themselves.
            //
            // Read this before changing anything nearby: RLS is a single
            // `for all to authenticated using (true)` policy per table, so an
            // account is total access to the whole database. Registration being
            // open means anyone who finds the URL can take it. Narrowing that
            // means per-user policies or an allowlist, not a flag here.
            shouldCreateUser: true,
          },
        })
        if (!error) return { error: null }
        // "Signups not allowed for otp" is what an unknown address gets back.
        // Say what it actually means to someone standing in a kitchen.
        return {
          error: /signups? not allowed/i.test(error.message)
            ? 'That email is not set up for this kitchen.'
            : error.message,
        }
      },
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [session, loading, callbackError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
