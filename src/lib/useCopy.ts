import { useState } from 'react'

/**
 * The "Copied" flash and the fallback for when the clipboard refuses.
 *
 * Shared by the Basket screen and History rather than written twice: History
 * must not reach for `useOrderSend` to get it, because that would mount basket
 * state — and a reachable `finish()` — on a screen that has no basket.
 *
 * `mark` is which button said it, so one hook can serve a whole-order button
 * and a button per supplier group without all of them lighting up at once. On
 * History it has to be scoped per order too: several orders are on screen at
 * once and two of them can easily share a group key.
 */
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function copy(text: string, mark: string) {
    try {
      await navigator.clipboard.writeText(text)
      setError(null)
      setCopied(mark)
      window.setTimeout(() => setCopied(null), 2000)
    } catch {
      // iOS refuses the clipboard outside a user gesture and Safari refuses it
      // over http — both land here, and both are recoverable by hand.
      setError('Could not copy. Long-press the list to select it instead.')
    }
  }

  return { copied, error, copy }
}
