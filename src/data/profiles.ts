import { supabase } from '../lib/supabase'

export type Profile = {
  id: string
  name: string
  must_change_password: boolean
}

/**
 * The signed-in account's own row. Returns null only if it genuinely isn't
 * there — a trigger creates one with every account, but an account that predates
 * migration 0005 and slipped the backfill would land here, so the caller
 * recreates rather than dead-ends.
 */
export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, must_change_password')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Profile | null) ?? null
}

/** Only ever called when fetchMyProfile came back empty. */
export async function createMyProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .insert({ id: userId, name: '' })
    .select('id, name, must_change_password')
    .single()
  if (error) throw new Error(error.message)
  return data as Profile
}

export async function setProfileName(userId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ name: name.trim().slice(0, 24) })
    .eq('id', userId)
  if (error) throw new Error(error.message)
}

export async function clearMustChangePassword(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ must_change_password: false })
    .eq('id', userId)
  if (error) throw new Error(error.message)
}

/**
 * Every account's name, for labelling somebody else's basket row. Read-only and
 * open to anyone signed in — the profiles_read policy exists for exactly this.
 */
export async function fetchProfileNames(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('profiles').select('id, name')
  if (error) throw new Error(error.message)
  return new Map((data as { id: string; name: string }[]).map((p) => [p.id, p.name]))
}
