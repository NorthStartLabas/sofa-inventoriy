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

/**
 * Fold case and diacritics before comparing. The catalog is Dutch — jalapeño,
 * crème fraîche, pâté — and nobody reaches for the accent key on a phone with
 * wet hands. NFD splits a letter from its accent so the accent can be dropped.
 */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

/**
 * Substring rather than prefix: half the catalog is two words ("Bloemkool
 * paars", "Zwarte knoflook mayo") and the word you remember is often the second
 * one. Pass a term already through `normalize` — once per render, not per row.
 */
export function matchesQuery(ingredient: Ingredient, normalizedTerm: string): boolean {
  return normalizedTerm === '' || normalize(ingredient.name).includes(normalizedTerm)
}
