import { Link } from 'react-router-dom'
import { useBasket } from '../basket/basketContext'
import { NameChip } from '../components/NameChip'
import { Stepper } from '../components/Stepper'
import { formatQuantity } from '../data/basket'
import { useCatalogStore } from '../data/catalogContext'

export function OrderScreen() {
  const { catalog, loading, error } = useCatalogStore()
  const basket = useBasket()

  const totalUnits = [...basket.items.values()].reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="mx-auto max-w-2xl pb-24">
      <header className="flex items-center gap-2 px-3 py-2">
        <h1 className="flex-1 text-lg font-semibold">Order</h1>
        <NameChip />
        <Link to="/catalog" className="h-11 px-2 text-base leading-[44px] text-neutral-500">
          Catalog
        </Link>
      </header>

      {(error ?? basket.error) && (
        <p className="border-y border-red-200 bg-red-50 px-4 py-3 text-base text-red-800">
          {error ?? basket.error}
        </p>
      )}

      {loading ? (
        <p className="px-4 py-8 text-base text-neutral-500">Loading…</p>
      ) : catalog.locations.length === 0 ? (
        <p className="px-4 py-8 text-base text-neutral-500">
          Nothing in the catalog yet.{' '}
          <Link to="/catalog" className="underline underline-offset-4">
            Add your locations and ingredients
          </Link>
          .
        </p>
      ) : (
        catalog.locations.map((location) => {
          const items = catalog.ingredients
            .filter((i) => i.location_id === location.id && !i.archived)
            .sort((a, b) => a.sort_order - b.sort_order)
          if (items.length === 0) return null

          const inBasket = items.filter((i) => basket.items.has(i.id)).length

          return (
            <section key={location.id}>
              <h2 className="sticky top-0 z-10 flex items-baseline gap-2 border-y border-neutral-200 bg-neutral-100 px-4 py-2">
                <span className="text-base font-semibold">{location.name}</span>
                {inBasket > 0 && (
                  <span className="text-base text-neutral-500">
                    {inBasket} of {items.length}
                  </span>
                )}
              </h2>

              <ul>
                {items.map((ingredient) => {
                  const line = basket.items.get(ingredient.id)
                  const quantity = line?.quantity ?? 0
                  return (
                    <li
                      key={ingredient.id}
                      className={`flex items-center gap-2 border-b border-neutral-200 py-1.5 pr-2 pl-4 ${
                        quantity > 0 ? 'bg-emerald-50' : ''
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-base ${
                            quantity > 0 ? 'font-semibold' : 'font-medium'
                          }`}
                        >
                          {ingredient.name}
                        </p>
                        {/* The stepper already carries the quantity and unit,
                            so once a row is in the basket this slot says who
                            put it there instead of repeating the number. */}
                        <p className="text-base text-neutral-500">
                          {quantity > 0 ? (line?.added_by ?? '') : ingredient.unit}
                        </p>
                      </div>

                      <Stepper
                        quantity={quantity}
                        unit={ingredient.unit}
                        onChange={(next) => basket.setQuantity(ingredient.id, next)}
                      />
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <span className="flex-1 text-base font-semibold">
            {basket.count === 0
              ? 'Basket empty'
              : `${basket.count} ${basket.count === 1 ? 'item' : 'items'} · ${formatQuantity(
                  totalUnits,
                )} units`}
          </span>
        </div>
      </div>
    </div>
  )
}
