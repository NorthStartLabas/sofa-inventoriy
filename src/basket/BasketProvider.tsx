import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  BasketWriteError,
  fetchBasket,
  performWrite,
  type BasketItem,
  type BasketWrite,
} from '../data/basket'
import { useDisplayName } from '../lib/displayName'
import { supabase } from '../lib/supabase'
import { BasketContext, type BasketValue } from './basketContext'
import { clearQueue, dequeue, enqueue, readQueue } from './retryQueue'

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
  const [unsaved, setUnsaved] = useState<Set<string>>(() => {
    // A queue left over from the last session, before anything is tapped.
    const queued = readQueue()
    return new Set(queued.map((e) => e.ingredient_id))
  })

  const timers = useRef(new Map<string, number>())
  // The write itself, kept next to its timer so a pending one can still be sent
  // when the phone goes in a pocket before the delay is up. Plain data rather
  // than a closure, because the retry queue has to survive a reload.
  const pending = useRef(new Map<string, BasketWrite>())
  // The writer runs on a timer, long after the render that scheduled it.
  const nameRef = useRef(name)
  nameRef.current = name
  // Same reason, for the realtime handler: it's registered once and must see
  // the current set, not the one captured when the channel was opened.
  const unsavedRef = useRef(unsaved)
  unsavedRef.current = unsaved

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

  const markUnsaved = useCallback((ingredientId: string, still: boolean) => {
    setUnsaved((prev) => {
      if (prev.has(ingredientId) === still) return prev
      const next = new Set(prev)
      if (still) next.add(ingredientId)
      else next.delete(ingredientId)
      return next
    })
  }, [])

  /**
   * Attempt one write. A refusal from the server is reported and the server's
   * version wins; a write that never reached it is queued and the tapped value
   * stays on screen, because it's still what the person meant.
   */
  const runWrite = useCallback(
    async (write: BasketWrite) => {
      try {
        await performWrite(write)
        dequeue(write.ingredient_id)
        markUnsaved(write.ingredient_id, false)
      } catch (e) {
        if (e instanceof BasketWriteError && e.retriable) {
          enqueue(write)
          markUnsaved(write.ingredient_id, true)
          setError('No connection — your changes are saved on this phone and will send.')
          throw e
        }
        setError(e instanceof Error ? e.message : 'That change did not save.')
        dequeue(write.ingredient_id)
        markUnsaved(write.ingredient_id, false)
        await reload()
      }
    },
    [reload, markUnsaved],
  )

  /** Replay whatever is queued, oldest first. Resolves to what's left. */
  const drainQueue = useCallback(async () => {
    for (const entry of readQueue()) {
      try {
        await runWrite(entry)
      } catch {
        // Still no connection. Stop rather than hammering the rest.
        break
      }
    }
    return readQueue().length
  }, [runWrite])

  const flush = useCallback(async () => {
    timers.current.forEach((timer) => window.clearTimeout(timer))
    timers.current.clear()
    const writes = [...pending.current.values()]
    pending.current.clear()
    // Sequential, not Promise.all: two writes for one ingredient must land in
    // order, and a queued one is by definition older than a pending one.
    await drainQueue()
    for (const write of writes) {
      try {
        await runWrite(write)
      } catch {
        break
      }
    }
    const left = readQueue().length
    if (left > 0) {
      throw new Error(
        `${left} ${left === 1 ? 'change hasn’t' : 'changes haven’t'} reached the server yet. ` +
          'Wait for signal — sending now would leave them out of the order.',
      )
    }
  }, [runWrite, drainQueue])

  // A tap followed within 400ms by locking the phone used to vanish: the timer
  // simply never fired. Hiding the page is the last reliable moment to send.
  //
  // flush rejects when the queue won't drain, which matters to the Finish
  // button but not here — there's nobody to tell, and the queue survives.
  useEffect(() => {
    const quietFlush = () => void flush().catch(() => {})
    const onHide = () => {
      if (document.visibilityState === 'hidden') quietFlush()
      // Coming back is also the cheapest moment to catch up on both fronts:
      // anything queued while there was no signal, and anything the other
      // phone changed while a dropped realtime connection wasn't reporting it.
      else {
        void drainQueue()
        void reload()
      }
    }
    const onOnline = () => void drainQueue()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', quietFlush)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', quietFlush)
      window.removeEventListener('online', onOnline)
      quietFlush()
    }
  }, [flush, drainQueue, reload])

  /**
   * Two phones, one basket. basket_items is in the supabase_realtime
   * publication with replica identity full (migration 0001) — the latter is
   * what makes DELETE usable, since without it payload.old carries only the
   * primary key and this Map is keyed by ingredient_id.
   *
   * This does not merge simultaneous edits: stepping the same item on two
   * phones still resolves last-write-wins at the row level, exactly as the
   * upsert always did. What it fixes is the two phones then showing different
   * numbers and nobody knowing which one Finish will send.
   */
  useEffect(() => {
    const channel = supabase
      .channel('basket_items')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'basket_items' },
        (payload) => {
          const row = (payload.new ?? payload.old) as Partial<BasketItem>
          const id = row.ingredient_id
          if (!id) return
          // Our own writes echo back. Ignore anything for an ingredient with a
          // change still in flight, or the echo would overwrite a newer tap
          // with the value we sent a moment ago.
          if (pending.current.has(id) || unsavedRef.current.has(id)) return

          setItems((prev) => {
            const next = new Map(prev)
            if (payload.eventType === 'DELETE') next.delete(id)
            else next.set(id, payload.new as BasketItem)
            return next
          })
        },
      )
      .subscribe((status) => {
        // Events that happened while the socket was down are simply gone, so
        // treat every (re)connection as a reason to re-read.
        if (status === 'SUBSCRIBED') void reload()
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [reload])

  const schedule = useCallback(
    (write: BasketWrite) => {
      window.clearTimeout(timers.current.get(write.ingredient_id))
      pending.current.set(write.ingredient_id, write)
      const timer = window.setTimeout(() => {
        timers.current.delete(write.ingredient_id)
        pending.current.delete(write.ingredient_id)
        void runWrite(write).catch(() => {})
      }, WRITE_DELAY_MS)
      timers.current.set(write.ingredient_id, timer)
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
      schedule({ ingredient_id: ingredientId, quantity: 0, added_by: null })
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

      schedule({
        ingredient_id: ingredientId,
        quantity: rounded,
        added_by: nameRef.current || null,
      })
    },
    [schedule, remove],
  )

  /**
   * After finish_order has already emptied basket_items server-side. Drops
   * pending writes on purpose — they refer to rows that no longer exist. The
   * queue is dropped for the same reason, and it is safe to: flush() had to
   * come back clean before the order could be sent at all.
   */
  const clear = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer))
    timers.current.clear()
    pending.current.clear()
    clearQueue()
    setUnsaved(new Set())
    setItems(new Map())
    setError(null)
  }, [])

  const value = useMemo<BasketValue>(
    () => ({
      items,
      loading,
      error,
      count: items.size,
      unsaved,
      setQuantity,
      remove,
      reload,
      clear,
      flush,
    }),
    [items, loading, error, unsaved, setQuantity, remove, reload, clear, flush],
  )

  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>
}
