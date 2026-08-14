import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useBasket } from '../../basket/basketContext'
import { NameChip } from '../../components/NameChip'
import { ScreenHeader } from '../../components/ScreenHeader'
import { headerLink, input, tab, wideWidth } from '../../components/styles'
import { useCatalogStore } from '../../data/catalogContext'
import { ORDER_VIEWS, useOrderView, type OrderView } from '../../lib/orderView'
import { AllView } from './AllView'
import { BasketPane } from './BasketPane'
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
    <div className="bg-sand">
      <ScreenHeader title="SOFA · Order" width={wideWidth}>
        <NameChip />
        <Link to="/catalog" className={headerLink}>
          Catalog
        </Link>
      </ScreenHeader>

      {/* One page scroll, not two. The route column scrolls the document as it
          always has — which is what RouteView's sticky headers and ReorderList's
          document-space measurements both assume — and the basket sticks beside
          it rather than becoming a second scroller. */}
      <div className={`mx-auto flex ${wideWidth} items-start`}>
        {/* The rules are what stop the column reading as a stretched phone: on
            a wide screen it's a sheet on the sand ground, with edges. */}
        <main className="min-h-screen min-w-0 flex-1 bg-surface pb-24 md:border-x md:border-rule lg:pb-0">
          {/* Switcher and search are one sticky block, not two stacked at
              different offsets. It measures 106px — 44 + 60 of control, plus the
              1px bottom border on each band — and anything sticky below has to
              use that number, borders included. */}
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
                  className="h-11 w-11 shrink-0 rounded-md border border-rule bg-surface text-base text-stone hover:border-ink"
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
        </main>

        <BasketPane />
      </div>

      {/* The phone's basket: a bar you tap to leave the list. Above lg the pane
          beside it says the same thing without taking a screen to do it. */}
      <Link to="/basket" className="fixed inset-x-0 bottom-0 z-40 block bg-ink lg:hidden">
        <div
          className={`mx-auto flex ${wideWidth} items-center gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]`}
        >
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
