import { supabase } from '../lib/supabase'

export type BasketItem = {
  id: string
  ingredient_id: string
  quantity: number
  added_by: string | null
  updated_at: string
}

export async function fetchBasket(): Promise<BasketItem[]> {
  const { data, error } = await supabase.from('basket_items').select('*')
  if (error) throw new Error(error.message)
  return data as BasketItem[]
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
  if (error) throw new Error(error.message)
}

export async function removeBasketItem(ingredientId: string): Promise<void> {
  const { error } = await supabase
    .from('basket_items')
    .delete()
    .eq('ingredient_id', ingredientId)
  if (error) throw new Error(error.message)
}

/** Trims the trailing zeros numeric columns come back with: 4.00 → 4, 0.50 → 0.5 */
export function formatQuantity(quantity: number): string {
  return String(Math.round(quantity * 100) / 100)
}
