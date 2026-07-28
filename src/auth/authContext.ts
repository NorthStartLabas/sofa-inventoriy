import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type AuthValue = {
  session: Session | null
  /** True until we know whether there's a stored session — avoids a sign-in flash. */
  loading: boolean
  callbackError: string | null
  sendMagicLink: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
