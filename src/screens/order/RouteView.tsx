import { Link } from 'react-router-dom'
import { useBasket } from '../../basket/basketContext'
import { IngredientRow } from '../../components/IngredientRow'
import { useCatalogStore } from '../../data/catalogContext'
import { isVisibleInOrder, matchesQuery, normalize } from '../../lib/orderView'

/**
 * The walking route: locations in their dragged order, ingredients in theirs.
 *
 * The rail down the left is the route itself — faint as you walk, solid at each
 * stop. It belongs to this view alone: Route is the only one of the three whose
 * order actually means something in the room, so it's the only one that earns a
 * structural device saying so.
 */
export function RouteView({ query }: { query: string }) {
  const { catalog } = useCatalogStore()
  const basket = useBasket()

  const term = normalize(query)

  const sections = catalog.locations
    .map((location) => ({
      location,
      items: catalog.ingredients
        .filter(
          (i) =>
            i.location_id === location.id &&
            // Two separate rules, composed rather than merged: visibility keeps
            // an archived row that's already in the basket, search doesn't —
            // typing a name means you want that name, archived or not.
            isVisibleInOrder(i, basket.items) &&
            matchesQuery(i, term),
        )
        .sort((a, b) => a.sort_order - b.sort_order),
    }))
    .filter((section) => section.items.length > 0)

  if (sections.length === 0) {
    return term === '' ? (
      <p className="px-4 py-8 text-base text-ink-2">
        {catalog.locations.length === 0
          ? 'Nothing in the catalog yet. '
          : 'No ingredients on the route yet. '}
        <Link to="/catalog" className="text-ink underline underline-offset-4">
          Open the catalog
        </Link>
        .
      </p>
    ) : (
      <p className="px-4 py-8 text-base text-ink-2">No ingredient matches “{query.trim()}”.</p>
    )
  }

  return (
    <>
      {sections.map(({ location, items }) => {
        const inBasket = items.filter((i) => basket.items.has(i.id)).length

        return (
          <section key={location.id} className="border-l-[3px] border-wine/25">
            {/* Clears the switcher and the search band above it: 44 + 60 for the
                controls, plus the 1px bottom border each band carries. Measured,
                not assumed — as 104 it pinned 2px under the block and lost its
                own top hairline. */}
            <h2 className="sticky top-[106px] z-10 -ml-[3px] flex items-baseline gap-2 border-y border-l-[3px] border-line border-l-wine bg-paper px-4 py-2">
              <span className="label text-base text-ink">{location.name}</span>
              {inBasket > 0 && (
                <span className="text-base text-ink-2 tabular-nums">
                  {inBasket} of {items.length}
                </span>
              )}
            </h2>

            <ul>
              {items.map((ingredient) => {
                const line = basket.items.get(ingredient.id)
                const quantity = line?.quantity ?? 0
                return (
                  <IngredientRow
                    key={ingredient.id}
                    ingredient={ingredient}
                    quantity={quantity}
                    // The stepper already carries the quantity and unit, so once
                    // a row is in the basket this slot says who put it there.
                    subtitle={quantity > 0 ? (line?.added_by ?? '') : ingredient.unit}
                    unsaved={basket.unsaved.has(ingredient.id)}
                  />
                )
              })}
            </ul>
          </section>
        )
      })}
    </>
  )
}
