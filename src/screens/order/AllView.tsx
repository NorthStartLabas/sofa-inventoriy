import { Link } from 'react-router-dom'
import { useBasket } from '../../basket/basketContext'
import { IngredientRow } from '../../components/IngredientRow'
import { useCatalogStore } from '../../data/catalogContext'
import { isVisibleInOrder, matchesQuery, normalize } from '../../lib/orderView'

/**
 * "I know what I want, don't make me walk." Everything, A–Z. The search box
 * used to live here; it moved to the shell so Route and Dish get it too.
 */
export function AllView({ query }: { query: string }) {
  const { catalog } = useCatalogStore()
  const basket = useBasket()

  const locationNames = new Map(catalog.locations.map((l) => [l.id, l.name]))
  const term = normalize(query)

  const items = catalog.ingredients
    .filter((i) => isVisibleInOrder(i, basket.items) && matchesQuery(i, term))
    .sort((a, b) => a.name.localeCompare(b.name))

  const nothingAtAll = catalog.ingredients.filter((i) => isVisibleInOrder(i, basket.items)).length === 0

  return (
    <>
      {nothingAtAll ? (
        <p className="px-4 py-8 text-base text-ink-2">
          Nothing in the catalog yet.{' '}
          <Link to="/catalog" className="text-ink underline underline-offset-4">
            Add your ingredients
          </Link>
          .
        </p>
      ) : items.length === 0 ? (
        <p className="px-4 py-8 text-base text-ink-2">
          No ingredient matches “{query.trim()}”.
        </p>
      ) : (
        <ul>
          {items.map((ingredient) => {
            const line = basket.items.get(ingredient.id)
            const quantity = line?.quantity ?? 0
            // Sorted by name rather than by route, so say where it lives —
            // otherwise there's no way back to the shelf.
            const where = locationNames.get(ingredient.location_id) ?? ''
            return (
              <IngredientRow
                key={ingredient.id}
                ingredient={ingredient}
                quantity={quantity}
                subtitle={where}
                unsaved={basket.unsaved.has(ingredient.id)}
              />
            )
          })}
        </ul>
      )}
    </>
  )
}
