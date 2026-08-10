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
    <div className="mx-auto max-w-2xl pb-24">
      <header className="flex items-center gap-2 px-3 py-2">
        <h1 className="flex-1 text-lg font-semibold">Order</h1>
        <NameChip />
        <Link to="/catalog" className="h-11 px-2 text-base leading-[44px] text-neutral-500">
          Catalog
        </Link>
      </header>

      <div className="sticky top-0 z-40 flex gap-1 border-b border-neutral-200 bg-white px-2">
        {ORDER_VIEWS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setView(option)}
            className={`min-h-[44px] flex-1 border-b-2 px-1 text-base font-medium ${
              view === option
                ? 'border-neutral-900 text-neutral-900'
                : 'border-transparent text-neutral-500'
            }`}
          >
            {LABELS[option]}
          </button>
        ))}
      </div>

      {(error ?? basket.error) && (
        <p className="border-y border-red-200 bg-red-50 px-4 py-3 text-base text-red-800">
          {error ?? basket.error}
        </p>
      )}

      {loading ? (
        <p className="px-4 py-8 text-base text-neutral-500">Loading…</p>
      ) : view === 'route' ? (
        <RouteView />
      ) : view === 'dish' ? (
        <DishView />
      ) : (
        <AllView />
      )}

      <Link
        to="/basket"
        className="fixed inset-x-0 bottom-0 block border-t border-neutral-200 bg-white/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <span className="flex-1 text-base font-semibold">
            {basket.count === 0
              ? 'Basket empty'
              : `${basket.count} ${basket.count === 1 ? 'item' : 'items'} in the basket`}
          </span>
          <span className="text-base text-neutral-500">
            {basket.count === 0 ? 'Open →' : 'Review →'}
          </span>
        </div>
      </Link>
    </div>
  )
}
