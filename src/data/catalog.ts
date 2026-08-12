import { supabase } from '../lib/supabase'
import type { Catalog, Dish, Ingredient, Location, Supplier } from '../types'

/** Postgres error for a foreign key that still has children pointing at it. */
const FK_VIOLATION = '23503'

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

export async function fetchCatalog(): Promise<Catalog> {
  const [locations, suppliers, ingredients, dishes, dishIngredients] = await Promise.all([
    supabase.from('locations').select('*').order('sort_order'),
    supabase.from('suppliers').select('*').order('name'),
    supabase.from('ingredients').select('*').order('sort_order'),
    supabase.from('dishes').select('*').order('name'),
    supabase.from('dish_ingredients').select('*'),
  ])

  return {
    locations: unwrap<Location[]>(locations),
    suppliers: unwrap<Supplier[]>(suppliers),
    ingredients: unwrap<Ingredient[]>(ingredients),
    dishes: unwrap<Dish[]>(dishes),
    dishIngredients: unwrap<Catalog['dishIngredients']>(dishIngredients),
  }
}

// --- locations --------------------------------------------------------------

export async function createLocation(name: string, sortOrder: number): Promise<Location> {
  const res = await supabase
    .from('locations')
    .insert({ name, sort_order: sortOrder })
    .select()
    .single()
  return unwrap<Location>(res)
}

export async function renameLocation(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('locations').update({ name }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteLocation(id: string): Promise<void> {
  const { error } = await supabase.from('locations').delete().eq('id', id)
  if (error) {
    if (error.code === FK_VIOLATION) {
      // Archiving deliberately does *not* help here — an archived ingredient
      // keeps its location_id, and the foreign key is on delete restrict.
      throw new Error(
        'Delete or move this location’s ingredients first — archived ones still count.',
      )
    }
    throw new Error(error.message)
  }
}

// --- suppliers --------------------------------------------------------------

export async function createSupplier(name: string): Promise<Supplier> {
  const res = await supabase.from('suppliers').insert({ name }).select().single()
  return unwrap<Supplier>(res)
}

export async function renameSupplier(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('suppliers').update({ name }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteSupplier(id: string): Promise<void> {
  // Ingredients reference suppliers with on delete set null, so this always works.
  const { error } = await supabase.from('suppliers').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// --- ingredients ------------------------------------------------------------

export type IngredientInput = {
  name: string
  unit: string
  location_id: string
  supplier_id: string | null
}

export async function createIngredient(
  input: IngredientInput,
  sortOrder: number,
): Promise<Ingredient> {
  const res = await supabase
    .from('ingredients')
    .insert({ ...input, sort_order: sortOrder })
    .select()
    .single()
  return unwrap<Ingredient>(res)
}

export async function updateIngredient(id: string, input: IngredientInput): Promise<void> {
  const { error } = await supabase.from('ingredients').update(input).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function setIngredientArchived(id: string, archived: boolean): Promise<void> {
  const { error } = await supabase.from('ingredients').update({ archived }).eq('id', id)
  if (error) throw new Error(error.message)
}

/**
 * Nothing blocks this. Dish links and basket rows cascade; order lines keep
 * their own copy of the name and unit (migration 0004) and just drop the id,
 * so history still reads correctly with the ingredient gone.
 */
export async function deleteIngredient(id: string): Promise<void> {
  const { error } = await supabase.from('ingredients').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// --- dishes -----------------------------------------------------------------

export async function createDish(name: string): Promise<Dish> {
  const res = await supabase.from('dishes').insert({ name }).select().single()
  return unwrap<Dish>(res)
}

export async function renameDish(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('dishes').update({ name }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteDish(id: string): Promise<void> {
  const { error } = await supabase.from('dishes').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// --- dish ↔ ingredient links ------------------------------------------------

/** Replaces the whole set of dishes an ingredient belongs to. */
export async function setDishesForIngredient(
  ingredientId: string,
  dishIds: string[],
): Promise<void> {
  const del = await supabase.from('dish_ingredients').delete().eq('ingredient_id', ingredientId)
  if (del.error) throw new Error(del.error.message)
  if (dishIds.length === 0) return

  const { error } = await supabase
    .from('dish_ingredients')
    .insert(dishIds.map((dish_id) => ({ dish_id, ingredient_id: ingredientId })))
  if (error) throw new Error(error.message)
}

/** Replaces the whole set of ingredients on a dish. */
export async function setIngredientsForDish(
  dishId: string,
  ingredientIds: string[],
): Promise<void> {
  const del = await supabase.from('dish_ingredients').delete().eq('dish_id', dishId)
  if (del.error) throw new Error(del.error.message)
  if (ingredientIds.length === 0) return

  const { error } = await supabase
    .from('dish_ingredients')
    .insert(ingredientIds.map((ingredient_id) => ({ dish_id: dishId, ingredient_id })))
  if (error) throw new Error(error.message)
}

// --- ordering ---------------------------------------------------------------

/**
 * Writes sort_order = position for each id. Small lists and a rare screen, so
 * one update per row beats hand-rolling a bulk upsert that would have to carry
 * every not-null column along for the ride.
 */
export async function persistOrder(
  table: 'locations' | 'ingredients',
  ids: string[],
): Promise<void> {
  const results = await Promise.all(
    ids.map((id, index) => supabase.from(table).update({ sort_order: index }).eq('id', id)),
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) throw new Error(failed.error.message)
}
