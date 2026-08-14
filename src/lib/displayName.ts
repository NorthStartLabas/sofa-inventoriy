import { useCallback, useSyncExternalStore } from 'react'

const KEY = 'kitchen.displayName'

/**
 * One value, shared by every caller, rather than a copy of it per component.
 *
 * This used to be `useState` + a `storage` listener, which meant each call site
 * held its own copy and `storage` — which only fires in *other* tabs — was the
 * only thing that could ever reconcile them. So changing the name in NameChip
 * left the copy BasketScreen sends to `finish_order` stale until a reload, and
 * the sign-in gate could never see the name being set below it at all.
 */
let current = localStorage.getItem(KEY) ?? ''
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

// Registered once, not per subscriber. Another tab (or another phone's browser
// on the same device) writing the key is still the cross-tab path.
window.addEventListener('storage', (e) => {
  if (e.key !== KEY) return
  current = e.newValue ?? ''
  emit()
})

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Who's holding the phone. Kept per-device rather than per-account so either
 * person can put their own name on a line without signing out — it's only ever
 * shown as `added_by`, and it grants nothing.
 */
export function useDisplayName() {
  const name = useSyncExternalStore(subscribe, () => current)

  const setName = useCallback((next: string) => {
    const trimmed = next.trim().slice(0, 24)
    if (trimmed === current) return
    current = trimmed
    localStorage.setItem(KEY, trimmed)
    emit()
  }, [])

  return { name, setName }
}
