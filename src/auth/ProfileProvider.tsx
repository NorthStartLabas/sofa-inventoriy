import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  clearMustChangePassword,
  createMyProfile,
  fetchMyProfile,
  fetchProfileNames,
  setProfileName,
} from '../data/profiles'
import { ProfileContext, type ProfileValue } from './profileContext'

/**
 * Who you are, according to the database rather than according to this phone.
 *
 * The name used to be `localStorage` behind a `useSyncExternalStore` module
 * store. That was a two-person design and it produced a bug that looked like a
 * broken screen: a phone that had set a name months earlier never saw the new
 * "who's ordering?" prompt, while a fresh laptop did, because the two devices
 * held genuinely different state. Six accounts later, the name has to follow the
 * person to whatever they sign in on.
 *
 * localStorage stays, but only as a paint cache keyed by account, so the header
 * shows the right name on the first frame instead of flashing empty while the
 * profile loads. The row in the database is the truth; the cache never decides
 * anything.
 *
 * This still gates the *interface*, never permission — RLS decides what anyone
 * can read or write and has never heard of a display name.
 */
const cacheKey = (userId: string) => `kitchen.name:${userId}`

function readCache(userId: string): string {
  try {
    return localStorage.getItem(cacheKey(userId)) ?? ''
  } catch {
    // Private mode, or a full store. The profile fetch is right behind this.
    return ''
  }
}

function writeCache(userId: string, name: string): void {
  try {
    localStorage.setItem(cacheKey(userId), name)
  } catch {
    // Nothing useful to do — the name is already in the database.
  }
}

export function ProfileProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [name, setNameState] = useState(() => readCache(userId))
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [names, setNames] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    let active = true

    void (async () => {
      try {
        const profile = (await fetchMyProfile(userId)) ?? (await createMyProfile(userId))
        if (!active) return
        setNameState(profile.name)
        writeCache(userId, profile.name)
        setMustChangePassword(profile.must_change_password)
        setError(null)
      } catch (e) {
        if (!active) return
        // A cached name is not enough to go on: mustChangePassword is unknown,
        // and guessing false would wave someone past a forced change.
        setError(e instanceof Error ? e.message : 'Could not load your account.')
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [userId])

  // Everyone's names, for labelling somebody else's basket row. Separate from
  // the profile read so a failure here costs a label, not the whole gate.
  useEffect(() => {
    let active = true
    void fetchProfileNames()
      .then((map) => {
        if (active) setNames(map)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [userId])

  const setName = useCallback(
    async (next: string) => {
      const trimmed = next.trim().slice(0, 24)
      if (trimmed === name) return
      // Optimistic, like the catalog store: one person edits their own name, and
      // a failure surfaces rather than being reconciled.
      setNameState(trimmed)
      writeCache(userId, trimmed)
      try {
        await setProfileName(userId, trimmed)
        setNames((prev) => new Map(prev).set(userId, trimmed))
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save your name.')
      }
    },
    [name, userId],
  )

  const markPasswordChanged = useCallback(async () => {
    await clearMustChangePassword(userId)
    setMustChangePassword(false)
  }, [userId])

  const value = useMemo<ProfileValue>(
    () => ({
      userId,
      name,
      mustChangePassword,
      loading,
      error,
      setName,
      markPasswordChanged,
      names,
    }),
    [userId, name, mustChangePassword, loading, error, setName, markPasswordChanged, names],
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}
