import { Link } from 'react-router-dom'
import { useBasket } from '../../basket/basketContext'
import { NameChip } from '../../components/NameChip'
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

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-surface pb-24">
      <header className="flex items-center gap-2 bg-tile px-3 py-2">
        <h1 className="label flex-1 text-xl">Order</h1>
        <NameChip />
        <Link to="/catalog" className="min-h-[44px] px-2 text-base leading-[44px] text-steel">
          Catalog
        </Link>
      </header>

      <div className="sticky top-0 z-40 flex border-y border-rule bg-surface">
        {ORDER_VIEWS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setView(option)}
            aria-current={view === option}
            className={`mark min-h-[44px] flex-1 border-b-2 text-base font-medium ${
              view === option ? 'border-tape text-tape' : 'border-transparent text-steel'
            }`}
          >
            {LABELS[option]}
          </button>
        ))}
      </div>

      {(error ?? basket.error) && (
        <p className="border-b border-flag/30 bg-flag-wash px-4 py-3 text-base text-flag">
          {error ?? basket.error}
        </p>
      )}

      {loading ? (
        <p className="px-4 py-8 text-base text-steel">Loading…</p>
      ) : view === 'route' ? (
        <RouteView />
      ) : view === 'dish' ? (
        <DishView />
      ) : (
        <AllView />
      )}

      <Link
        to="/basket"
        className="fixed inset-x-0 bottom-0 block border-t border-rule bg-surface/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <span className="flex-1 text-base">
            {basket.count === 0 ? (
              <span className="text-steel">Basket empty</span>
            ) : (
              <>
                <span className="label text-base text-tape tabular-nums">
                  {basket.count} {basket.count === 1 ? 'item' : 'items'}
                </span>
                <span className="ml-2 text-steel">in the basket</span>
              </>
            )}
          </span>
          <span className="label text-base text-ink">
            {basket.count === 0 ? 'Open →' : 'Review →'}
          </span>
        </div>
      </Link>
    </div>
  )
}
