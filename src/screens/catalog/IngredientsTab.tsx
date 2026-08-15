import { useState } from 'react'
import { ReorderList } from '../../components/ReorderList'
import { secondaryButton } from '../../components/styles'
import {
  createIngredient,
  deleteIngredient,
  persistOrder,
  setDishesForIngredient,
  setIngredientArchived,
  updateIngredient,
  type IngredientInput,
} from '../../data/catalog'
import type { CatalogStore } from '../../data/useCatalog'
import type { Ingredient } from '../../types'
import { IngredientEditor } from './IngredientEditor'

export function IngredientsTab({ store }: { store: CatalogStore }) {
  const { catalog, setCatalog, mutate, run } = store
  const [showArchived, setShowArchived] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingIn, setAddingIn] = useState<string | null>(null)

  if (catalog.locations.length === 0) {
    return (
      <p className="px-4 py-8 text-base text-ink-2">
        Add a location first — every ingredient has to live somewhere on the route.
      </p>
    )
  }

  const dishCount = (ingredientId: string) =>
    catalog.dishIngredients.filter((di) => di.ingredient_id === ingredientId).length

  const supplierName = (id: string | null) =>
    id ? catalog.suppliers.find((s) => s.id === id)?.name : undefined

  function inLocation(locationId: string) {
    return catalog.ingredients
      .filter((i) => i.location_id === locationId && (showArchived || !i.archived))
      .sort((a, b) => a.sort_order - b.sort_order)
  }

  // sort_order is only ever compared within a location, so numbering each
  // location from zero is enough.
  function reorder(ids: string[]) {
    void mutate(
      (c) => ({
        ...c,
        ingredients: c.ingredients.map((i) => {
          const index = ids.indexOf(i.id)
          return index === -1 ? i : { ...i, sort_order: index }
        }),
      }),
      () => persistOrder('ingredients', ids),
    )
  }

  function save(existing: Ingredient | null, values: IngredientInput, dishIds: string[]) {
    if (existing) {
      setEditingId(null)
      void mutate(
        (c) => ({
          ...c,
          ingredients: c.ingredients.map((i) => (i.id === existing.id ? { ...i, ...values } : i)),
          dishIngredients: [
            ...c.dishIngredients.filter((di) => di.ingredient_id !== existing.id),
            ...dishIds.map((dish_id) => ({ dish_id, ingredient_id: existing.id })),
          ],
        }),
        async () => {
          await updateIngredient(existing.id, values)
          await setDishesForIngredient(existing.id, dishIds)
        },
      )
      return
    }

    setAddingIn(null)
    void run(async () => {
      const sortOrder = inLocation(values.location_id).length
      const created = await createIngredient(values, sortOrder)
      await setDishesForIngredient(created.id, dishIds)
      setCatalog((c) => ({
        ...c,
        ingredients: [...c.ingredients, created],
        dishIngredients: [
          ...c.dishIngredients,
          ...dishIds.map((dish_id) => ({ dish_id, ingredient_id: created.id })),
        ],
      }))
    })
  }

  function toggleArchived(ingredient: Ingredient) {
    setEditingId(null)
    const archived = !ingredient.archived
    void mutate(
      (c) => ({
        ...c,
        ingredients: c.ingredients.map((i) => (i.id === ingredient.id ? { ...i, archived } : i)),
      }),
      () => setIngredientArchived(ingredient.id, archived),
    )
  }

  // dish_ingredients and basket_items cascade server-side, so the optimistic
  // state has to drop them here too or the counts stay stale until a reload.
  function remove(ingredient: Ingredient) {
    setEditingId(null)
    void mutate(
      (c) => ({
        ...c,
        ingredients: c.ingredients.filter((i) => i.id !== ingredient.id),
        dishIngredients: c.dishIngredients.filter((di) => di.ingredient_id !== ingredient.id),
      }),
      () => deleteIngredient(ingredient.id),
    )
  }

  return (
    <div className="pb-8">
      <label className="flex min-h-[44px] items-center gap-2 px-4 text-base text-ink-2">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
          className="h-5 w-5"
        />
        Show archived
      </label>

      {catalog.locations.map((location) => {
        const items = inLocation(location.id)
        return (
          <section key={location.id}>
            {/* 45px, not 44: the tab row above is a 44px control plus a 1px
                bottom border, and at 44 this pinned a pixel underneath it. */}
            <h2 className="label sticky top-[45px] z-30 border-y border-line bg-paper px-4 py-2 text-base text-ink">
              {location.name}
              <span className="num ml-2 text-ink-2">{items.length}</span>
            </h2>

            <div className="px-1">
              <ReorderList
                items={items}
                getId={(i) => i.id}
                onReorder={reorder}
                hideHandle={(i) => editingId === i.id}
                renderRow={(ingredient) =>
                  editingId === ingredient.id ? (
                    <IngredientEditor
                      catalog={catalog}
                      ingredient={ingredient}
                      defaultLocationId={location.id}
                      onSave={(values, dishIds) => save(ingredient, values, dishIds)}
                      onCancel={() => setEditingId(null)}
                      onToggleArchived={() => toggleArchived(ingredient)}
                      onDelete={() => remove(ingredient)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingId(ingredient.id)}
                      className="flex min-h-[44px] w-full items-center gap-2 border-b border-line py-2 pr-3 text-left"
                    >
                      <span
                        className={`flex-1 text-base font-medium ${
                          ingredient.archived ? 'text-ink-2 line-through' : ''
                        }`}
                      >
                        {ingredient.name}
                      </span>
                      <span className="text-base text-ink-2">
                        {[
                          ingredient.unit || null,
                          supplierName(ingredient.supplier_id),
                          dishCount(ingredient.id) > 0
                            ? `${dishCount(ingredient.id)} ${
                                dishCount(ingredient.id) === 1 ? 'dish' : 'dishes'
                              }`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </button>
                  )
                }
              />
            </div>

            {addingIn === location.id ? (
              <IngredientEditor
                catalog={catalog}
                ingredient={null}
                defaultLocationId={location.id}
                onSave={(values, dishIds) => save(null, values, dishIds)}
                onCancel={() => setAddingIn(null)}
              />
            ) : (
              <div className="px-4 py-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null)
                    setAddingIn(location.id)
                  }}
                  className={secondaryButton}
                >
                  + Add to {location.name}
                </button>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
