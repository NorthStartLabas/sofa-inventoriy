import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatQuantity } from '../data/basket'
import { useCatalogStore } from '../data/catalogContext'
import { fetchOrders, type Order } from '../data/orders'

/** "10 Aug, 14:32" — the day and time an order went out is all anyone asks. */
function sentAtLabel(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function HistoryScreen() {
  const { catalog } = useCatalogStore()
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setOrders(await fetchOrders())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the history.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Archived ingredients still resolve here — fetchCatalog returns them, and
  // order_lines is on delete restrict precisely so history keeps its names.
  const ingredient = (id: string) => catalog.ingredients.find((i) => i.id === id)

  return (
    <div className="mx-auto max-w-2xl pb-16">
      <header className="flex items-center gap-2 px-3 py-2">
        <Link to="/basket" className="h-11 px-1 text-base leading-[44px] text-neutral-500">
          ← Basket
        </Link>
        <h1 className="flex-1 text-lg font-semibold">History</h1>
        <Link to="/" className="h-11 px-2 text-base leading-[44px] text-neutral-500">
          Order
        </Link>
      </header>

      {error && (
        <p className="border-y border-red-200 bg-red-50 px-4 py-3 text-base text-red-800">
          {error}
        </p>
      )}

      {orders === null ? (
        <p className="px-4 py-8 text-base text-neutral-500">Loading…</p>
      ) : orders.length === 0 ? (
        <p className="px-4 py-8 text-base text-neutral-500">
          No orders sent yet. They show up here once you finish one.
        </p>
      ) : (
        <ul>
          {orders.map((order) => {
            const open = expanded === order.id
            const total = order.order_lines.length

            return (
              <li key={order.id} className="border-b border-neutral-200">
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : order.id)}
                  className="flex min-h-[44px] w-full items-center gap-2 px-4 py-2 text-left"
                >
                  <span className="flex-1 text-base font-medium">
                    {sentAtLabel(order.sent_at)}
                    {order.sent_by && (
                      <span className="ml-2 font-normal text-neutral-500">{order.sent_by}</span>
                    )}
                  </span>
                  <span className="text-base text-neutral-500">
                    {total} {total === 1 ? 'item' : 'items'}
                  </span>
                </button>

                {open && (
                  <ul className="pb-3">
                    {order.order_lines.map((line) => {
                      const found = ingredient(line.ingredient_id)
                      return (
                        <li
                          key={line.id}
                          className="flex items-baseline gap-2 px-4 py-1 text-base"
                        >
                          <span className="flex-1 text-neutral-700">
                            {found?.name ?? 'Removed ingredient'}
                          </span>
                          <span className="tabular-nums">
                            {formatQuantity(line.quantity)}
                            {found?.unit && (
                              <span className="ml-1 text-neutral-500">{found.unit}</span>
                            )}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
