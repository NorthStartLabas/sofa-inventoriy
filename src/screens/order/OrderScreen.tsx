import { Link } from 'react-router-dom'
import { useBasket } from '../../basket/basketContext'
import { NameChip } from '../../components/NameChip'
import { ScreenHeader } from '../../components/ScreenHeader'
import { headerLink, tab } from '../../components/styles'
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
      <ScreenHeader title="SOFA · Order">
        <NameChip />
        <Link to="/catalog" className={headerLink}>
          Catalog
        </Link>
      </ScreenHeader>

      <div className="sticky top-0 z-40 flex border-b border-rule bg-surface">
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

      {(error ?? basket.error) && (
        <p className="border-b border-flag/30 bg-flag-wash px-4 py-3 text-base text-flag">
          {error ?? basket.error}
        </p>
      )}

      {loading ? (
        <p className="px-4 py-8 text-base text-stone">Loading…</p>
      ) : view === 'route' ? (
        <RouteView />
      ) : view === 'dish' ? (
        <DishView />
      ) : (
        <AllView />
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
