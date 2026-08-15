import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type AuthValue = {
  session: Session | null
  /** True until we know whether there's a stored session — avoids a sign-in flash. */
  loading: boolean
  callbackError: string | null
  /**
   * Arrived through a password-reset link, so the app has to send them to
   * SetPassword rather than to the order screen. Cleared once they've chosen one.
   */
  recovering: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  /** The one remaining email round-trip, and only when someone is locked out. */
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
