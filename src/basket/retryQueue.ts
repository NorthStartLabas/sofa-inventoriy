import type { BasketWrite } from '../data/basket'

const KEY = 'kitchen.basketQueue'

/**
 * Basket writes that couldn't reach the server, held until they can.
 *
 * The walk-in cooler has no signal. A tap made in there used to be reported as
 * an error and then overwritten by a re-read, so it was simply lost — and the
 * person who made it had already moved on down the route.
 *
 * Keyed by ingredient_id, one entry per ingredient, last write winning. That
 * mirrors the upsert the write itself does: the basket holds a quantity, not a
 * history of taps, so replaying an older value would be wrong.
 *
 * localStorage rather than memory, because the phone that lost signal is also
 * the phone that gets locked, backgrounded and eventually reloaded.
 */
export function readQueue(): BasketWrite[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is BasketWrite =>
        typeof e === 'object' && e !== null && typeof (e as BasketWrite).ingredient_id === 'string',
    )
  } catch {
    // A corrupt or unavailable store must not take the basket down with it.
    return []
  }
}

function write(entries: BasketWrite[]): void {
  try {
    if (entries.length === 0) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify(entries))
  } catch {
    // Private mode, or full. Nothing useful to do — the value is still on screen.
  }
}

export function enqueue(entry: BasketWrite): void {
  write([...readQueue().filter((e) => e.ingredient_id !== entry.ingredient_id), entry])
}

export function dequeue(ingredientId: string): void {
  write(readQueue().filter((e) => e.ingredient_id !== ingredientId))
}

export function clearQueue(): void {
  write([])
}
