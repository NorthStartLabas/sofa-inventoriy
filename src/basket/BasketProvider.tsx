import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  fetchBasket,
  removeBasketItem,
  setBasketQuantity,
  type BasketItem,
} from '../data/basket'
import { useDisplayName } from '../lib/displayName'
import { BasketContext, type BasketValue } from './basketContext'

/**
 * Steppers get tapped fast and repeatedly. Hold the last value briefly and
 * write once, rather than firing a request per tap.
 */
const WRITE_DELAY_MS = 400

export function BasketProvider({ children }: { children: ReactNode }) {
  const { name } = useDisplayName()
  const [items, setItems] = useState<Map<string, BasketItem>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const timers = useRef(new Map<string, number>())
  // The writer runs on a timer, long after the render that scheduled it.
  const nameRef = useRef(name)
  nameRef.current = name

  const reload = useCallback(async () => {
    try {
      const rows = await fetchBasket()
      setItems(new Map(rows.map((row) => [row.ingredient_id, row])))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the basket.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((id) => window.clearTimeout(id))
  }, [])

  const schedule = useCallback(
    (ingredientId: string, write: () => Promise<void>) => {
      window.clearTimeout(timers.current.get(ingredientId))
      const timer = window.setTimeout(() => {
        timers.current.delete(ingredientId)
        write().catch(async (e: unknown) => {
          setError(e instanceof Error ? e.message : 'That change did not save.')
          // Phase 6 turns this into a retry queue; for now the server wins.
          await reload()
        })
      }, WRITE_DELAY_MS)
      timers.current.set(ingredientId, timer)
    },
    [reload],
  )

  const remove = useCallback<BasketValue['remove']>(
    (ingredientId) => {
      setError(null)
      setItems((prev) => {
        const next = new Map(prev)
        next.delete(ingredientId)
        return next
      })
      schedule(ingredientId, () => removeBasketItem(ingredientId))
    },
    [schedule],
  )

  const setQuantity = useCallback<BasketValue['setQuantity']>(
    (ingredientId, quantity) => {
      const rounded = Math.max(0, Math.round(quantity * 100) / 100)
      // Stepping down to zero is how you take something out of the basket.
      if (rounded === 0) {
        remove(ingredientId)
        return
      }

      setError(null)
      setItems((prev) => {
        const next = new Map(prev)
        const existing = next.get(ingredientId)
        next.set(ingredientId, {
          id: existing?.id ?? `local:${ingredientId}`,
          ingredient_id: ingredientId,
          quantity: rounded,
          added_by: nameRef.current || null,
          updated_at: new Date().toISOString(),
        })
        return next
      })

      schedule(ingredientId, () =>
        setBasketQuantity(ingredientId, rounded, nameRef.current || null),
      )
    },
    [schedule, remove],
  )

  const value = useMemo<BasketValue>(
    () => ({ items, loading, error, count: items.size, setQuantity, remove, reload }),
    [items, loading, error, setQuantity, remove, reload],
  )

  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>
}
