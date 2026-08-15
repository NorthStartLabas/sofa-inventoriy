import type { BasketWrite } from '../data/basket'

/**
 * Per account, not per device. Two people share the tablet on the pass; a write
 * queued in the walk-in by one of them must not surface in the other's basket
 * after a sign-out and a sign-in. RLS would refuse it anyway now that every row
 * carries a user_id — this is what keeps it from being attempted at all.
 */
const keyFor = (userId: string) => `kitchen.basketQueue:${userId}`

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
export function readQueue(userId: string): BasketWrite[] {
  try {
    const raw = localStorage.getItem(keyFor(userId))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is BasketWrite =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as BasketWrite).ingredient_id === 'string' &&
        // Entries written before the key was namespaced have no user_id, and
        // replaying one would be a write with nobody's name on it.
        typeof (e as BasketWrite).user_id === 'string',
    )
  } catch {
    // A corrupt or unavailable store must not take the basket down with it.
    return []
  }
}

function write(userId: string, entries: BasketWrite[]): void {
  try {
    if (entries.length === 0) localStorage.removeItem(keyFor(userId))
    else localStorage.setItem(keyFor(userId), JSON.stringify(entries))
  } catch {
    // Private mode, or full. Nothing useful to do — the value is still on screen.
  }
}

export function enqueue(entry: BasketWrite): void {
  write(entry.user_id, [
    ...readQueue(entry.user_id).filter((e) => e.ingredient_id !== entry.ingredient_id),
    entry,
  ])
}

export function dequeue(userId: string, ingredientId: string): void {
  write(
    userId,
    readQueue(userId).filter((e) => e.ingredient_id !== ingredientId),
  )
}

export function clearQueue(userId: string): void {
  write(userId, [])
}
