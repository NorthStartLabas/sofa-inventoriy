import { supabase } from '../lib/supabase'

export type BasketItem = {
  id: string
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

export async function fetchBasket(): Promise<BasketItem[]> {
  const { data, error } = await supabase.from('basket_items').select('*')
  if (error) throw new Error(error.message)
  return data as BasketItem[]
}

/** What one queued write needs to be replayed later. quantity 0 means remove. */
export type BasketWrite = {
  ingredient_id: string
  quantity: number
  added_by: string | null
}

export function performWrite(write: BasketWrite): Promise<void> {
  return write.quantity === 0
    ? removeBasketItem(write.ingredient_id)
    : setBasketQuantity(write.ingredient_id, write.quantity, write.added_by)
}

/**
 * One row per ingredient, upserted on the unique ingredient_id. Never an
 * insert-then-sum: if the ingredient is already in the basket this replaces
 * the quantity, which is what "already added: 4 l" in the UI promises.
 */
export async function setBasketQuantity(
  ingredientId: string,
  quantity: number,
  addedBy: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('basket_items')
    .upsert(
      { ingredient_id: ingredientId, quantity, added_by: addedBy },
      { onConflict: 'ingredient_id' },
    )
  if (error) fail(error)
}

export async function removeBasketItem(ingredientId: string): Promise<void> {
  const { error } = await supabase
    .from('basket_items')
    .delete()
    .eq('ingredient_id', ingredientId)
  if (error) fail(error)
}

/** Trims the trailing zeros numeric columns come back with: 4.00 → 4, 0.50 → 0.5 */
export function formatQuantity(quantity: number): string {
  return String(Math.round(quantity * 100) / 100)
}
