import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ScreenHeader } from '../components/ScreenHeader'
import {
  columnWidth,
  headerLink,
  quietButton,
  secondaryButton,
  sectionBar,
  sectionCount,
  sectionName,
} from '../components/styles'
import { formatQuantity } from '../data/basket'
import { useCatalogStore } from '../data/catalogContext'
import { fetchOrders, type Order } from '../data/orders'
import { clock } from '../lib/alreadyText'
import { groupOrdersByDay } from '../lib/orderDays'
import { groupOrder, orderText, whatsappUrl } from '../lib/orderText'
import { useCopy } from '../lib/useCopy'

const PAGE = 25

type CopyProps = {
  copied: string | null
  copy: (text: string, mark: string) => void
}

/**
 * One past order, opened up: the same per-supplier grouping and the same two
 * export buttons the Basket screen has.
 *
 * This is the whole point of the screen. The buttons on the Basket screen sit
 * to the left of Finish, so pressing Finish first is an easy mistake — and it
 * used to be an unrecoverable one, because Finish empties the basket and the
 * only copy of the list was in it. Now the list outlives the basket.
 */
function PastOrder({ order, copied, copy }: { order: Order } & CopyProps) {
  const { catalog } = useCatalogStore()
  const groups = useMemo(() => groupOrder(order.order_lines, catalog), [order, catalog])
  // Dated the day it was *made*, not today. A message sent late is still that
  // day's order, and the supplier reading it should see the day it was written.
  const text = useMemo(() => orderText(groups, new Date(order.sent_at)), [groups, order.sent_at])

  return (
    <div className="border-t border-line bg-paper pb-3">
      {/* Two supplier groups fit side by side on a wide screen, and
          break-inside-avoid on the section is what stops a heading being
          orphaned from its lines. Safe here and nowhere else in the app: this
          is static text with nothing draggable in it. */}
      <div className="lg:columns-2">
        {groups.map((group) => (
          <section key={group.key} className="break-inside-avoid pt-3">
            <div className="flex items-center gap-2 px-4">
              <span className="label text-base text-ink">{group.heading}</span>
              <span className={`flex-1 ${sectionCount}`}>{group.lines.length}</span>
              {/* One message per recipient: the whole-order buttons below are
                  right for one supplier and wrong for three. */}
              {groups.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => copy(orderText([group], new Date(order.sent_at)), `${order.id}:${group.key}`)}
                    className={quietButton}
                  >
                    {copied === `${order.id}:${group.key}` ? 'Copied' : 'Copy'}
                  </button>
                  <a
                    href={whatsappUrl(orderText([group], new Date(order.sent_at)))}
                    target="_blank"
                    rel="noreferrer"
                    className={`${quietButton} leading-[44px]`}
                  >
                    Send
                  </a>
                </>
              )}
            </div>

            <ul>
              {/* Name and unit come off the line itself, so a past order keeps
                  saying what it said — even after the ingredient is renamed, or
                  deleted outright. */}
              {group.lines.map((line) => (
                <li key={line.key} className="flex items-baseline gap-2 px-4 py-1 text-base">
                  <span className="flex-1 text-ink">{line.name}</span>
                  <span className="tabular-nums">
                    {formatQuantity(line.quantity)}
                    {line.unit && <span className="ml-1 text-ink-2">{line.unit}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-3 flex gap-2 px-4">
        <button type="button" onClick={() => copy(text, `${order.id}:all`)} className={secondaryButton}>
          {copied === `${order.id}:all` ? 'Copied' : 'Copy'}
        </button>
        <a
          href={whatsappUrl(text)}
          target="_blank"
          rel="noreferrer"
          className={`${secondaryButton} flex-1 text-center leading-[44px]`}
        >
          WhatsApp
        </a>
      </div>
    </div>
  )
}

/**
 * "Fri 15 Aug" with the digits put back into Inter.
 *
 * The day heading is a `.label` — serif, caps, tracked — and Cormorant's
 * figures are old-style on a small x-height, so a date set in it reads a size
 * or two below the 16px it actually is. `.label .num` exists for exactly this;
 * every other count in the app sits *beside* a label and can wear the class on
 * its own, and this is the one that sits *inside* one.
 */
function DayHeading({ label }: { label: string }) {
  return (
    <>
      {label.split(/(\d+)/).map((part, index) =>
        /^\d/.test(part) ? (
          <span key={index} className="num">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  )
}

export function HistoryScreen() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [atEnd, setAtEnd] = useState(false)
  const { copied, error: copyError, copy } = useCopy()

  const load = useCallback(async () => {
    try {
      const page = await fetchOrders(PAGE)
      setOrders(page)
      setAtEnd(page.length < PAGE)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the history.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function loadOlder() {
    const current = orders
    if (!current?.length) return
    setLoadingMore(true)
    try {
      // Keyset from the oldest row on screen, so an order somebody else sends
      // while this is open can't shift the window and skip one.
      const page = await fetchOrders(PAGE, current[current.length - 1].sent_at)
      setOrders([...current, ...page])
      setAtEnd(page.length < PAGE)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load older orders.')
    } finally {
      setLoadingMore(false)
    }
  }

  const days = useMemo(() => groupOrdersByDay(orders ?? []), [orders])

  return (
    <div className="bg-paper">
      <ScreenHeader
        title="History"
        leading={
          <Link to="/" className={headerLink}>
            ←
          </Link>
        }
      >
        <Link to="/basket" className={headerLink}>
          Basket
        </Link>
      </ScreenHeader>

      <div className={`mx-auto min-h-screen ${columnWidth} bg-surface pb-16 md:border-x md:border-line`}>
        {(error ?? copyError) && (
          <p className="border-y border-bad/30 bg-bad-bg px-4 py-3 text-base text-bad">
            {error ?? copyError}
          </p>
        )}

        {orders === null ? (
          <p className="px-4 py-8 text-base text-ink-2">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="px-4 py-8 text-base text-ink-2">
            No orders sent yet. They show up here once you finish one.
          </p>
        ) : (
          <>
            {days.map((day) => (
              <section key={day.key}>
                {/* Nothing sticky sits above this on the History screen, so it
                    pins at 0 — none of the Order screen's border arithmetic. */}
                <h2 className={`sticky top-0 z-10 ${sectionBar}`}>
                  <span className={sectionName}>
                    <DayHeading label={day.label} />
                  </span>
                  <span className={sectionCount}>
                    {day.orders.length} {day.orders.length === 1 ? 'order' : 'orders'}
                  </span>
                </h2>

                <ul>
                  {day.orders.map((order) => {
                    const open = expanded === order.id
                    const total = order.order_lines.length

                    return (
                      <li key={order.id} className="border-b border-line">
                        <button
                          type="button"
                          onClick={() => setExpanded(open ? null : order.id)}
                          aria-expanded={open}
                          className="flex min-h-[44px] w-full items-center gap-2 px-4 py-2 text-left hover:bg-paper"
                        >
                          {/* The day is on the heading above, so the row only
                              owes you the time and who sent it. */}
                          <span className="num text-base font-medium text-ink">
                            {clock(order.sent_at)}
                          </span>
                          <span className="flex-1 truncate text-base text-ink-2">
                            {order.sent_by}
                          </span>
                          <span className="num text-base text-ink-2">
                            {total} {total === 1 ? 'item' : 'items'}
                          </span>
                          <span aria-hidden className="text-base text-ink-2">
                            {open ? '▾' : '▸'}
                          </span>
                        </button>

                        {open && <PastOrder order={order} copied={copied} copy={copy} />}
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}

            {!atEnd && (
              <div className="px-4 py-4">
                <button
                  type="button"
                  onClick={loadOlder}
                  disabled={loadingMore}
                  className={`${secondaryButton} w-full`}
                >
                  {loadingMore ? 'Loading…' : 'Show older'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
