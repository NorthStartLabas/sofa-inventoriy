import { useCallback, useEffect, useState } from 'react'

const KEY = 'kitchen.displayName'

/**
 * Who's holding the phone. Kept per-device rather than per-account so either
 * person can put their own name on a line without signing out — it's only ever
 * shown as `added_by`, never used for permissions.
 */
export function useDisplayName() {
  const [name, setName] = useState<string>(() => localStorage.getItem(KEY) ?? '')

  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === KEY) setName(e.newValue ?? '')
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  const save = useCallback((next: string) => {
    const trimmed = next.trim().slice(0, 24)
    localStorage.setItem(KEY, trimmed)
    setName(trimmed)
  }, [])

  return { name, setName: save }
}
