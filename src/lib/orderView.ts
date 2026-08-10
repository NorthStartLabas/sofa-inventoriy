import { useCallback, useEffect, useState } from 'react'
import type { BasketItem } from '../data/basket'
import type { Ingredient } from '../types'

export const ORDER_VIEWS = ['route', 'dish', 'all'] as const
export type OrderView = (typeof ORDER_VIEWS)[number]

const KEY = 'kitchen.orderView'

function read(): OrderView {
  const stored = localStorage.getItem(KEY)
  return ORDER_VIEWS.includes(stored as OrderView) ? (stored as OrderView) : 'route'
}

/**
 * Which way you're looking at the same ingredients. Per-device like the display
 * name: it's a habit, not a setting the other person has to agree with.
 */
export function useOrderView() {
  const [view, setView] = useState<OrderView>(read)

  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === KEY) setView(read())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  const choose = useCallback((next: OrderView) => {
    localStorage.setItem(KEY, next)
    setView(next)
  }, [])

  return { view, setView: choose }
}

/**
 * Archived stock stays out of the order views — unless it's already in the
 * basket, in which case hiding it would leave a line nobody can find or step
 * back down to zero. All three views share this rule.
 */
export function isVisibleInOrder(
  ingredient: Ingredient,
  basketItems: Map<string, BasketItem>,
): boolean {
  return !ingredient.archived || basketItems.has(ingredient.id)
}
