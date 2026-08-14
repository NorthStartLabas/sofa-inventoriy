import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ScreenHeader } from '../components/ScreenHeader'
import { columnWidth, headerLink } from '../components/styles'
import { formatQuantity } from '../data/basket'
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

  return (
    <div className="bg-sand">
      <ScreenHeader
        title="History"
        leading={
          <Link to="/basket" className={headerLink}>
            ←
          </Link>
        }
      >
        <Link to="/" className={headerLink}>
          Order
        </Link>
      </ScreenHeader>

      <div className={`mx-auto min-h-screen ${columnWidth} bg-surface pb-16 md:border-x md:border-rule`}>
        {error && (
          <p className="border-y border-flag/30 bg-flag-wash px-4 py-3 text-base text-flag">
            {error}
          </p>
        )}

        {orders === null ? (
          <p className="px-4 py-8 text-base text-stone">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="px-4 py-8 text-base text-stone">
            No orders sent yet. They show up here once you finish one.
          </p>
        ) : (
          <ul>
            {orders.map((order) => {
              const open = expanded === order.id
              const total = order.order_lines.length

              return (
                <li key={order.id} className="border-b border-rule">
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : order.id)}
                    className="flex min-h-[44px] w-full items-center gap-2 px-4 py-2 text-left hover:bg-sand"
                  >
                    <span className="flex-1 text-base font-medium tabular-nums text-ink">
                      {sentAtLabel(order.sent_at)}
                      {order.sent_by && (
                        <span className="ml-2 font-normal text-stone">{order.sent_by}</span>
                      )}
                    </span>
                    <span className="label text-base text-stone tabular-nums">
                      {total} {total === 1 ? 'item' : 'items'}
                    </span>
                  </button>

                  {open && (
                    // A 36-line order is a long scroll on a screen with room to
                    // spare. Safe to reflow here and nowhere else in the app: this
                    // is static text with nothing draggable in it.
                    <ul className="pb-3 lg:columns-2">
                      {/* Name and unit come off the line itself, so a past order
                          keeps saying what it said — even after the ingredient is
                          renamed, or deleted outright. */}
                      {order.order_lines.map((line) => (
                        <li
                          key={line.id}
                          // Or a line splits down the middle across the column break.
                          className="flex break-inside-avoid items-baseline gap-2 px-4 py-1 text-base"
                        >
                          <span className="flex-1 text-ink">{line.ingredient_name}</span>
                          <span className="tabular-nums">
                            {formatQuantity(line.quantity)}
                            {line.unit && <span className="ml-1 text-stone">{line.unit}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
