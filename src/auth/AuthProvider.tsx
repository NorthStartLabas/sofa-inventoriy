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

    // The magic-link fragment has to be consumed before we ask for the session,
    // otherwise the first read comes back empty and we flash the sign-in screen.
    consumeAuthFromUrl()
      .then(({ error }) => {
        if (active && error) setCallbackError(error)
        return supabase.auth.getSession()
      })
      .then(({ data }) => {
        if (!active) return
        setSession(data.session)
        setLoading(false)
      })

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
          options: { emailRedirectTo: redirectUrl() },
        })
        return { error: error ? error.message : null }
      },
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [session, loading, callbackError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
