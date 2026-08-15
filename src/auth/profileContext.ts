import { createContext, useContext } from 'react'

export type ProfileValue = {
  /** The signed-in account's id — what a basket row is owned by. */
  userId: string
  /** Empty until they've been asked. Gates the interface, never permission. */
  name: string
  /** Handed a temporary password; must choose their own before going on. */
  mustChangePassword: boolean
  /** True until the profile row has been read once. */
  loading: boolean
  error: string | null
  setName: (next: string) => Promise<void>
  /** Called once the new password has actually been accepted by Supabase. */
  markPasswordChanged: () => Promise<void>
  /** Every account's name, for saying whose basket something is already in. */
  names: Map<string, string>
}

export const ProfileContext = createContext<ProfileValue | null>(null)

export function useProfile(): ProfileValue {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used inside <ProfileProvider>')
  return ctx
}
