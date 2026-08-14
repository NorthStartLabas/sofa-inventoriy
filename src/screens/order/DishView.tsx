import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useBasket } from '../../basket/basketContext'
import { IngredientRow } from '../../components/IngredientRow'
import { useCatalogStore } from '../../data/catalogContext'
import { isVisibleInOrder, matchesQuery, normalize } from '../../lib/orderView'
import type { Ingredient } from '../../types'

/**
 * "I'm doing pasta tonight — what am I short of?" Dishes expand in place so
 * two of them can be checked against each other without navigating.
 */
export function DishView({ query }: { query: string }) {
  const { catalog } = useCatalogStore()
  const basket = useBasket()
  const [open, setOpen] = useState<Set<string>>(new Set())

  const term = normalize(query)
  const locationRank = new Map(catalog.locations.map((l, index) => [l.id, index]))
  const byId = new Map(catalog.ingredients.map((i) => [i.id, i]))

  function ingredientsFor(dishId: string): Ingredient[] {
    return catalog.dishIngredients
      .filter((di) => di.dish_id === dishId)
      .map((di) => byId.get(di.ingredient_id))
      .filter(
        (i): i is Ingredient =>
          i !== undefined && isVisibleInOrder(i, basket.items) && matchesQuery(i, term),
      )
      .sort((a, b) => {
        // Route order inside a dish too — checking one still means a single
        // pass along the shelves rather than criss-crossing the kitchen.
        const byLocation =
          (locationRank.get(a.location_id) ?? Number.MAX_SAFE_INTEGER) -
          (locationRank.get(b.location_id) ?? Number.MAX_SAFE_INTEGER)
        return byLocation !== 0 ? byLocation : a.sort_order - b.sort_order
      })
  }

  function toggle(dishId: string) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (!next.delete(dishId)) next.add(dishId)
      return next
    })
  }

  if (catalog.dishes.length === 0) {
    return (
      <p className="px-4 py-8 text-base text-stone">
        No dishes yet.{' '}
        <Link to="/catalog" className="text-ink underline underline-offset-4">
          Add one in the catalog
        </Link>
        .
      </p>
    )
  }

  // While searching, a dish with no match is noise — 26 headings hiding one hit.
  // With the box empty every dish shows, including the ten that have nothing
  // linked yet, since that emptiness is itself worth seeing.
  const dishes = catalog.dishes
    .map((dish) => ({ dish, items: ingredientsFor(dish.id) }))
    .filter(({ items }) => term === '' || items.length > 0)

  if (dishes.length === 0) {
    return <p className="px-4 py-8 text-base text-stone">No ingredient matches “{query.trim()}”.</p>
  }

  return (
    <>
      {dishes.map(({ dish, items }) => {
        const inBasket = items.filter((i) => basket.items.has(i.id)).length
        // A search opens every dish it matched, without writing to `open` —
        // so clearing the box puts the collapse state back as you left it.
        const isOpen = open.has(dish.id) || term !== ''

        return (
          <section key={dish.id}>
            <h2 className="border-b border-rule bg-sand">
              <button
                type="button"
                onClick={() => toggle(dish.id)}
                className="flex min-h-[44px] w-full items-baseline gap-2 px-4 py-2 text-left"
                aria-expanded={isOpen}
              >
                <span className="label text-base text-ink">{dish.name}</span>
                <span className="flex-1 text-base text-stone tabular-nums">
                  {inBasket > 0 ? `${inBasket} of ${items.length}` : items.length}
                </span>
                <span className="text-base text-stone">{isOpen ? '▾' : '▸'}</span>
              </button>
            </h2>

            {isOpen &&
              (items.length === 0 ? (
                <p className="bg-surface px-4 py-4 text-base text-stone">
                  Nothing linked to this dish yet.{' '}
                  <Link to="/catalog" className="text-ink underline underline-offset-4">
                    Pick its ingredients
                  </Link>
                  .
                </p>
              ) : (
                <ul>
                  {items.map((ingredient) => {
                    const line = basket.items.get(ingredient.id)
                    const quantity = line?.quantity ?? 0
                    return (
                      <IngredientRow
                        key={ingredient.id}
                        ingredient={ingredient}
                        quantity={quantity}
                        subtitle={quantity > 0 ? (line?.added_by ?? '') : ingredient.unit}
                        onChange={(next) => basket.setQuantity(ingredient.id, next)}
                      />
                    )
                  })}
                </ul>
              ))}
          </section>
        )
      })}
    </>
  )
}
