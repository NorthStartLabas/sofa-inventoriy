import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useBasket } from '../../basket/basketContext'
import { NameChip } from '../../components/NameChip'
import { ScreenHeader } from '../../components/ScreenHeader'
import { headerLink, input, tab } from '../../components/styles'
import { useCatalogStore } from '../../data/catalogContext'
import { ORDER_VIEWS, useOrderView, type OrderView } from '../../lib/orderView'
import { AllView } from './AllView'
import { DishView } from './DishView'
import { RouteView } from './RouteView'

const LABELS: Record<OrderView, string> = {
  route: 'Route',
  dish: 'Dish',
  all: 'All',
}

/**
 * The shell around the three ways of looking at the same ingredients. Header,
 * switcher and basket bar stay put; only the list between them changes, so
 * switching never moves the thing your thumb is already on.
 */
export function OrderScreen() {
  const { loading, error } = useCatalogStore()
  const basket = useBasket()
  const { view, setView } = useOrderView()
  // The term lives in the shell, not in each view, so it survives switching:
  // find something in All, flip to Route, and it's still filtered — which is
  // how you find out which shelf it's on. 169 ingredients is past the point
  // where scrolling one of 73 in a location is a way of finding anything.
  const [query, setQuery] = useState('')

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-surface pb-24">
      <ScreenHeader title="SOFA · Order">
        <NameChip />
        <Link to="/catalog" className={headerLink}>
          Catalog
        </Link>
      </ScreenHeader>

      {/* Switcher and search are one sticky block (44px + 60px = 104px), not two
          stacked at different offsets — anything sticky below sits at top-26. */}
      <div className="sticky top-0 z-40">
        <div className="flex border-b border-rule bg-surface">
          {ORDER_VIEWS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              aria-current={view === option}
              className={tab(view === option)}
            >
              {LABELS[option]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 border-b border-rule bg-sand px-3 py-2">
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
              className="h-11 w-11 shrink-0 rounded-md border border-rule bg-surface text-base text-stone"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {(error ?? basket.error) && (
        <p className="border-b border-flag/30 bg-flag-wash px-4 py-3 text-base text-flag">
          {error ?? basket.error}
        </p>
      )}

      {loading ? (
        <p className="px-4 py-8 text-base text-stone">Loading…</p>
      ) : view === 'route' ? (
        <RouteView query={query} />
      ) : view === 'dish' ? (
        <DishView query={query} />
      ) : (
        <AllView query={query} />
      )}

      <Link
        to="/basket"
        className="fixed inset-x-0 bottom-0 block bg-ink"
      >
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <span className="flex-1 text-base">
            {basket.count === 0 ? (
              <span className="text-sand/75">Basket empty</span>
            ) : (
              <>
                {/* Apricot's other job: the accent, on anthracite rather than under it. */}
                <span className="label text-base text-apricot tabular-nums">
                  {basket.count} {basket.count === 1 ? 'item' : 'items'}
                </span>
                <span className="ml-2 text-sand/75">in the basket</span>
              </>
            )}
          </span>
          <span className="label text-base text-sand">
            {basket.count === 0 ? 'Open →' : 'Review →'}
          </span>
        </div>
      </Link>
    </div>
  )
}
