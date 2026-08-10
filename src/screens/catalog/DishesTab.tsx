import { useState } from 'react'
import { dangerButton, input, primaryButton, secondaryButton } from '../../components/styles'
import {
  createDish,
  deleteDish,
  renameDish,
  setIngredientsForDish,
} from '../../data/catalog'
import type { CatalogStore } from '../../data/useCatalog'
import type { Dish } from '../../types'

export function DishesTab({ store }: { store: CatalogStore }) {
  const { catalog, setCatalog, mutate, run, getCatalog } = store
  const [newName, setNewName] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const ingredientIdsFor = (dishId: string) =>
    catalog.dishIngredients.filter((di) => di.dish_id === dishId).map((di) => di.ingredient_id)

  function add() {
    const name = newName.trim()
    if (!name) return
    setNewName('')
    void run(async () => {
      const created = await createDish(name)
      setCatalog((c) => ({
        ...c,
        dishes: [...c.dishes, created].sort((a, b) => a.name.localeCompare(b.name)),
      }))
    })
  }

  function saveRename(dish: Dish) {
    const name = draft.trim()
    setRenaming(null)
    if (!name || name === dish.name) return
    void mutate(
      (c) => ({
        ...c,
        dishes: c.dishes
          .map((d) => (d.id === dish.id ? { ...d, name } : d))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }),
      () => renameDish(dish.id, name),
    )
  }

  function remove(dish: Dish) {
    void mutate(
      (c) => ({
        ...c,
        dishes: c.dishes.filter((d) => d.id !== dish.id),
        dishIngredients: c.dishIngredients.filter((di) => di.dish_id !== dish.id),
      }),
      () => deleteDish(dish.id),
    )
  }

  function toggleIngredient(dishId: string, ingredientId: string) {
    // Read through getCatalog, not this render's `catalog`: setIngredientsForDish
    // replaces the dish's whole set, so a second tap landing before the re-render
    // would compute from a stale snapshot and undo the first one.
    const current = getCatalog()
      .dishIngredients.filter((di) => di.dish_id === dishId)
      .map((di) => di.ingredient_id)
    const next = current.includes(ingredientId)
      ? current.filter((id) => id !== ingredientId)
      : [...current, ingredientId]

    void mutate(
      (c) => ({
        ...c,
        dishIngredients: [
          ...c.dishIngredients.filter((di) => di.dish_id !== dishId),
          ...next.map((ingredient_id) => ({ dish_id: dishId, ingredient_id })),
        ],
      }),
      () => setIngredientsForDish(dishId, next),
    )
  }

  return (
    <div className="px-4 py-4">
      <p className="mb-4 text-base text-neutral-500">
        A dish is a checklist of what needs to be in the house for it — not a recipe.
      </p>

      {catalog.dishes.map((dish) => {
        const chosen = ingredientIdsFor(dish.id)
        const open = expanded === dish.id

        return (
          <div key={dish.id} className="border-b border-neutral-200">
            <div className="flex items-center gap-2 py-2">
              {renaming === dish.id ? (
                <>
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveRename(dish)}
                    className={input}
                  />
                  <button type="button" onClick={() => saveRename(dish)} className={primaryButton}>
                    Save
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : dish.id)}
                    className="min-h-[44px] flex-1 text-left text-base font-medium"
                  >
                    {dish.name}
                    <span className="ml-2 font-normal text-neutral-400">{chosen.length}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(dish.name)
                      setRenaming(dish.id)
                    }}
                    className={secondaryButton}
                  >
                    Rename
                  </button>
                  <button type="button" onClick={() => remove(dish)} className={dangerButton}>
                    Delete
                  </button>
                </>
              )}
            </div>

            {open && (
              <div className="pb-4">
                {catalog.locations.map((location) => {
                  const items = catalog.ingredients
                    .filter((i) => i.location_id === location.id && !i.archived)
                    .sort((a, b) => a.sort_order - b.sort_order)
                  if (items.length === 0) return null

                  return (
                    <div key={location.id} className="mt-2">
                      <p className="text-base font-semibold text-neutral-500">{location.name}</p>
                      {items.map((ingredient) => (
                        <label
                          key={ingredient.id}
                          className="flex min-h-[44px] items-center gap-3 text-base"
                        >
                          <input
                            type="checkbox"
                            checked={chosen.includes(ingredient.id)}
                            onChange={() => toggleIngredient(dish.id, ingredient.id)}
                            className="h-5 w-5"
                          />
                          {ingredient.name}
                          {ingredient.unit && (
                            <span className="text-neutral-400">{ingredient.unit}</span>
                          )}
                        </label>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {catalog.dishes.length === 0 && (
        <p className="py-6 text-base text-neutral-500">No dishes yet.</p>
      )}

      <div className="mt-6 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Dish name"
          className={input}
        />
        <button type="button" onClick={add} disabled={!newName.trim()} className={primaryButton}>
          Add
        </button>
      </div>
    </div>
  )
}
