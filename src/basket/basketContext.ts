import { createContext, useContext } from 'react'
import type { BasketItem } from '../data/basket'

export type BasketValue = {
  /** Keyed by ingredient_id — the same key the database enforces as unique. */
  items: Map<string, BasketItem>
  loading: boolean
  error: string | null
  /** Distinct ingredients in the basket. */
  count: number
  /**
   * Ingredients whose latest change hasn't reached the server yet. Shown as a
   * quiet marker on the row rather than reverting what was tapped.
   */
  unsaved: Set<string>
  setQuantity: (ingredientId: string, quantity: number) => void
  remove: (ingredientId: string) => void
  reload: () => Promise<void>
  /** Empty the local basket after the server has already cleared it. */
  clear: () => void
  /**
   * Send any debounced writes now, and wait for them to land. Also drains the
   * offline retry queue: finish_order reads basket_items server-side, so
   * anything still queued would be silently missing from the order. Rejects if
   * it can't get everything through — the caller must not send a short order.
   */
  flush: () => Promise<void>
}

export const BasketContext = createContext<BasketValue | null>(null)

export function useBasket(): BasketValue {
  const ctx = useContext(BasketContext)
  if (!ctx) throw new Error('useBasket must be used inside <BasketProvider>')
  return ctx
}
