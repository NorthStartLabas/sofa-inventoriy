import { supabase } from '../lib/supabase'

export type BasketItem = {
  id: string
  /** Whose basket this row is in. Unique together with ingredient_id. */
  user_id: string
  ingredient_id: string
  quantity: number
  added_by: string | null
  updated_at: string
}

/**
 * A write that failed, and whether trying it again could ever help.
 *
 * The distinction matters because the retry queue must not replay a refusal:
 * a PostgREST rejection is the server saying no, and re-sending it forever
 * just hides it behind a spinner. PostgREST rejections carry a `code`
 * ('23503', 'PGRST301', …); a fetch that never reached the server has none,
 * which is what a walk-in cooler looks like from here.
 */
export class BasketWriteError extends Error {
  readonly retriable: boolean

  constructor(message: string, retriable: boolean) {
    super(message)
    this.name = 'BasketWriteError'
    this.retriable = retriable
  }
}

function fail(error: { message: string; code?: string }): never {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  throw new BasketWriteError(error.message, offline || !error.code)
}

/**
 * Every basket row, not just yours. Reading across accounts is what the
 * "somebody already has 2 of this" warning is built on, and the basket_read
 * policy exists for it; BasketProvider splits mine from theirs.
 */
export async function fetchBasket(): Promise<BasketItem[]> {
  const { data, error } = await supabase.from('basket_items').select('*')
  if (error) throw new Error(error.message)
  return data as BasketItem[]
}

/** What one queued write needs to be replayed later. quantity 0 means remove. */
export type BasketWrite = {
  /**
   * Carried rather than filled in at send time. A write queued offline, then
   * replayed after somebody else signed in on this device, is refused by RLS
   * instead of landing in the wrong person's basket.
   */
  user_id: string
  ingredient_id: string
  quantity: number
  added_by: string | null
}

export function performWrite(write: BasketWrite): Promise<void> {
  return write.quantity === 0
    ? removeBasketItem(write.user_id, write.ingredient_id)
    : setBasketQuantity(write.user_id, write.ingredient_id, write.quantity, write.added_by)
}

/**
 * One row per ingredient per person, upserted on the unique pair. Never an
 * insert-then-sum: if the ingredient is already in your basket this replaces
 * the quantity, which is what the number on the stepper promises.
 */
export async function setBasketQuantity(
  userId: string,
  ingredientId: string,
  quantity: number,
  addedBy: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('basket_items')
    .upsert(
      { user_id: userId, ingredient_id: ingredientId, quantity, added_by: addedBy },
      { onConflict: 'user_id,ingredient_id' },
    )
  if (error) fail(error)
}

export async function removeBasketItem(userId: string, ingredientId: string): Promise<void> {
  const { error } = await supabase
    .from('basket_items')
    .delete()
    .eq('user_id', userId)
    .eq('ingredient_id', ingredientId)
  if (error) fail(error)
}

/** Trims the trailing zeros numeric columns come back with: 4.00 → 4, 0.50 → 0.5 */
export function formatQuantity(quantity: number): string {
  return String(Math.round(quantity * 100) / 100)
}
