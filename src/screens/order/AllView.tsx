import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useBasket } from '../../basket/basketContext'
import { IngredientRow } from '../../components/IngredientRow'
import { input } from '../../components/styles'
import { useCatalogStore } from '../../data/catalogContext'
import { isVisibleInOrder } from '../../lib/orderView'

/** "I know what I want, don't make me walk." Everything, A–Z, filterable. */
export function AllView() {
  const { catalog } = useCatalogStore()
  const basket = useBasket()
  const [query, setQuery] = useState('')

  const locationNames = new Map(catalog.locations.map((l) => [l.id, l.name]))
  const term = query.trim().toLowerCase()

  const items = catalog.ingredients
    .filter((i) => isVisibleInOrder(i, basket.items))
    .filter((i) => term === '' || i.name.toLowerCase().includes(term))
    .sort((a, b) => a.name.localeCompare(b.name))

  const nothingAtAll = catalog.ingredients.filter((i) => isVisibleInOrder(i, basket.items)).length === 0

  return (
    <>
      {/* top-11 clears the view switcher, which is sticky above it. */}
      <div className="sticky top-11 z-20 flex items-center gap-2 border-b border-rule bg-tile px-3 py-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find an ingredient"
          autoCapitalize="off"
          autoCorrect="off"
          className={input}
        />
        {query !== '' && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="h-11 w-11 shrink-0 rounded-md border border-rule bg-surface text-base text-steel"
          >
            ✕
          </button>
        )}
      </div>

      {nothingAtAll ? (
        <p className="px-4 py-8 text-base text-steel">
          Nothing in the catalog yet.{' '}
          <Link to="/catalog" className="text-tape underline underline-offset-4">
            Add your ingredients
          </Link>
          .
        </p>
      ) : items.length === 0 ? (
        <p className="px-4 py-8 text-base text-steel">
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
                onChange={(next) => basket.setQuantity(ingredient.id, next)}
              />
            )
          })}
        </ul>
      )}
    </>
  )
}
