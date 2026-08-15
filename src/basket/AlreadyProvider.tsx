import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { primaryButton, secondaryButton } from '../components/styles'
import { useCatalogStore } from '../data/catalogContext'
import { fetchOrderedToday, type SentToday } from '../data/orders'
import { amount, clock } from '../lib/alreadyText'
import { supabase } from '../lib/supabase'
import { AlreadyContext, type AlreadyValue } from './alreadyContext'
import { useBasket } from './basketContext'

/**
 * "Somebody already ordered that today."
 *
 * Splitting the baskets is what made this necessary. With one shared basket a
 * duplicate was visible on the row itself — the quantity was simply already
 * there. Now the only way to see it is to be told, and the two halves of "told"
 * are different queries: what has been **sent** today, and what is **waiting**
 * in somebody else's basket.
 *
 * The question is asked once per ingredient, on the way up from zero, and the
 * answer is remembered for the session. A warning that fires again on the
 * fourth tap of `+` is a warning people learn to swat away without reading.
 */
export function AlreadyProvider({ children }: { children: ReactNode }) {
  const basket = useBasket()
  const { catalog } = useCatalogStore()
  const [sent, setSent] = useState<Map<string, SentToday[]>>(new Map())
  const [asking, setAsking] = useState<{ ingredientId: string; next: number } | null>(null)
  // Not state: acknowledging is the last thing that happens before the write,
  // and a re-render in between would let the same question be asked twice.
  const acknowledged = useRef(new Set<string>())

  const reload = useCallback(() => {
    void fetchOrderedToday()
      .then(setSent)
      // A warning that couldn't load is a missing warning, not a broken screen.
      // The basket half still works, and the row simply says less.
      .catch(() => {})
  }, [])

  useEffect(() => {
    reload()
    // An order sent on the next stove has to show up here while you're looking
    // at the screen — that near-simultaneous case is the entire point (migration
    // 0007 puts orders in the realtime publication for this).
    const channel = supabase
      .channel('orders_today')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, reload)
      .subscribe()

    const onVisible = () => {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      void supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reload])

  const check = useCallback<AlreadyValue['check']>(
    (ingredientId) => {
      const today = sent.get(ingredientId) ?? []
      const waiting = basket.others.get(ingredientId) ?? []
      if (today.length === 0 && waiting.length === 0) return null
      return { sent: today, waiting }
    },
    [sent, basket.others],
  )

  const step = useCallback<AlreadyValue['step']>(
    (ingredientId, current, next) => {
      // Only on the way up from nothing. Adjusting a quantity you already chose
      // is not the mistake this is here to catch, and neither is taking one out.
      const firstAdd = current === 0 && next > 0
      if (!firstAdd || acknowledged.current.has(ingredientId) || !check(ingredientId)) {
        basket.setQuantity(ingredientId, next)
        return
      }
      setAsking({ ingredientId, next })
    },
    [basket, check],
  )

  const value = useMemo<AlreadyValue>(() => ({ check, step }), [check, step])

  const pending = asking ? check(asking.ingredientId) : null
  const ingredient = asking
    ? catalog.ingredients.find((i) => i.id === asking.ingredientId)
    : undefined

  return (
    <AlreadyContext.Provider value={value}>
      {children}

      {asking && pending && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={pending.sent.length > 0 ? 'Already ordered today' : 'Already in a basket'}
          // Above both fixed bars. A sheet from the bottom on a phone, because
          // that's where the thumb already is; a card in the middle once there's
          // room for the list to stay visible behind it.
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
        >
          <div className="w-full max-w-md lift-2 rounded-t-[18px] border border-line bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-[18px] sm:pb-4">
            {/* Two different situations, and calling the second one "ordered"
                would be wrong in the way that teaches people to ignore it. */}
            <h2 className="label text-base text-ink-2">
              {pending.sent.length > 0 ? 'Already ordered today' : 'Already in a basket'}
            </h2>
            <p className="mt-1 text-base font-semibold text-ink">
              {ingredient?.name ?? 'This ingredient'}
            </p>

            <ul className="mt-3 border-l-2 border-line pl-3">
              {pending.sent.map((line, index) => (
                <li key={`sent-${index}`} className="text-base text-ink">
                  {line.by} ordered {amount(line.quantity, line.unit ?? ingredient?.unit ?? '')} at{' '}
                  {clock(line.at)}
                </li>
              ))}
              {pending.waiting.map((other) => (
                <li key={`waiting-${other.userId}`} className="text-base text-ink">
                  {other.name} has {amount(other.quantity, ingredient?.unit ?? '')} in their basket
                </li>
              ))}
            </ul>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  acknowledged.current.add(asking.ingredientId)
                  basket.setQuantity(asking.ingredientId, asking.next)
                  setAsking(null)
                }}
                className={`${primaryButton} flex-1`}
              >
                Add it anyway
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => setAsking(null)}
                className={secondaryButton}
              >
                Leave it
              </button>
            </div>
          </div>
        </div>
      )}
    </AlreadyContext.Provider>
  )
}
