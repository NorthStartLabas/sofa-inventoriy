import type { Order } from '../data/orders'

/**
 * Which day an order belongs to, worked out **on the device**.
 *
 * Same decision, for the same reason, as `fetchOrderedToday` in
 * `src/data/orders.ts`: the phone is standing in the kitchen and its clock is
 * the kitchen's clock, which beats hard-coding a timezone. An order sent at
 * half past midnight lands on the day the person sending it thinks it did.
 */
function keyOf(date: Date): string {
  // Local parts on purpose. toISOString() would let UTC back in through the
  // side door and file a 01:00 order under the previous day for half the year.
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

export function dayKey(iso: string): string {
  return keyOf(new Date(iso))
}

/** "Today" / "Yesterday" / "Fri 15 Aug" — how anyone says it out loud. */
export function dayLabel(iso: string): string {
  const key = keyOf(new Date(iso))
  const today = new Date()
  if (key === keyOf(today)) return 'Today'

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (key === keyOf(yesterday)) return 'Yesterday'

  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export type OrderDay = {
  key: string
  label: string
  orders: Order[]
}

/**
 * Orders arrive newest first and stay in that order — this only inserts the
 * breaks, so paging in older ones appends without disturbing anything above.
 */
export function groupOrdersByDay(orders: Order[]): OrderDay[] {
  const days: OrderDay[] = []
  for (const order of orders) {
    const key = dayKey(order.sent_at)
    const last = days[days.length - 1]
    if (last && last.key === key) last.orders.push(order)
    else days.push({ key, label: dayLabel(order.sent_at), orders: [order] })
  }
  return days
}
