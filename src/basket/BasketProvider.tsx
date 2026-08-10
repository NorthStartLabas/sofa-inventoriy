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
  // The write itself, kept next to its timer so a pending one can still be sent
  // when the phone goes in a pocket before the delay is up.
  const pending = useRef(new Map<string, () => Promise<void>>())
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

  const runWrite = useCallback(
    (write: () => Promise<void>) =>
      write().catch(async (e: unknown) => {
        setError(e instanceof Error ? e.message : 'That change did not save.')
        // Phase 6 turns this into a retry queue; for now the server wins.
        await reload()
      }),
    [reload],
  )

  /**
   * Send everything still waiting on its timer, and resolve once it has landed.
   * Awaited before finishing an order — finish_order reads basket_items on the
   * server, so a tap still inside the debounce would be left out of the order.
   */
  const flush = useCallback(async () => {
    timers.current.forEach((timer) => window.clearTimeout(timer))
    timers.current.clear()
    const writes = [...pending.current.values()]
    pending.current.clear()
    await Promise.all(writes.map(runWrite))
  }, [runWrite])

  // A tap followed within 400ms by locking the phone used to vanish: the timer
  // simply never fired. Hiding the page is the last reliable moment to send.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    const onPageHide = () => void flush()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onPageHide)
      void flush()
    }
  }, [flush])

  const schedule = useCallback(
    (ingredientId: string, write: () => Promise<void>) => {
      window.clearTimeout(timers.current.get(ingredientId))
      pending.current.set(ingredientId, write)
      const timer = window.setTimeout(() => {
        timers.current.delete(ingredientId)
        pending.current.delete(ingredientId)
        runWrite(write)
      }, WRITE_DELAY_MS)
      timers.current.set(ingredientId, timer)
    },
    [runWrite],
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

  /**
   * After finish_order has already emptied basket_items server-side. Drops
   * pending writes on purpose — they refer to rows that no longer exist.
   */
  const clear = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer))
    timers.current.clear()
    pending.current.clear()
    setItems(new Map())
    setError(null)
  }, [])

  const value = useMemo<BasketValue>(
    () => ({ items, loading, error, count: items.size, setQuantity, remove, reload, clear, flush }),
    [items, loading, error, setQuantity, remove, reload, clear, flush],
  )

  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>
}
