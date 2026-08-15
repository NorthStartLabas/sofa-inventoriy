import { supabase } from '../lib/supabase'

export type OrderLine = {
  id: string
  order_id: string
  /** Null once the ingredient is deleted — the line outlives it on purpose. */
  ingredient_id: string | null
  /** What the line said when it was sent, not what the catalog says now. */
  ingredient_name: string
  unit: string | null
  quantity: number
}

export type Order = {
  id: string
  sent_at: string
  sent_by: string | null
  order_lines: OrderLine[]
}

/**
 * One round trip to public.finish_order: the order row, its lines, and the
 * emptied basket all land together or not at all. Throws 'The basket is empty.'
 * straight from Postgres if there was nothing to send.
 */
export async function finishOrder(sentBy: string | null): Promise<string> {
  const { data, error } = await supabase.rpc('finish_order', { p_sent_by: sentBy })
  if (error) throw new Error(error.message)
  return data as string
}

/** One line of an order that has already gone out today. */
export type SentToday = {
  by: string
  quantity: number
  unit: string | null
  at: string
}

/**
 * What has already been ordered today, keyed by ingredient.
 *
 * "Today" is the local day, worked out on the device rather than in SQL. The
 * phone is standing in the kitchen and its clock is the kitchen's clock, which
 * is both simpler and more honest than hard-coding Europe/Amsterdam into a
 * query — an order sent at half past midnight belongs to the day the person
 * thinks it does.
 *
 * `orders!inner` is what lets the date filter apply to the parent: without it
 * PostgREST returns every line and merely nulls the ones that don't match.
 * order_lines_ingredient_idx and orders_sent_at_idx already cover this.
 */
export async function fetchOrderedToday(): Promise<Map<string, SentToday[]>> {
  const since = new Date()
  since.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('order_lines')
    .select('ingredient_id, quantity, unit, orders!inner(sent_at, sent_by)')
    .not('ingredient_id', 'is', null)
    .gte('orders.sent_at', since.toISOString())
  if (error) throw new Error(error.message)

  type Row = {
    ingredient_id: string
    quantity: number
    unit: string | null
    orders: { sent_at: string; sent_by: string | null }
  }

  const map = new Map<string, SentToday[]>()
  for (const row of (data ?? []) as unknown as Row[]) {
    const entry: SentToday = {
      by: row.orders.sent_by ?? 'Somebody',
      quantity: row.quantity,
      unit: row.unit,
      at: row.orders.sent_at,
    }
    const list = map.get(row.ingredient_id)
    if (list) list.push(entry)
    else map.set(row.ingredient_id, [entry])
  }
  return map
}

/** Newest first. order_lines comes back embedded — one request, not one per order. */
export async function fetchOrders(limit = 25): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_lines(*)')
    .order('sent_at', { ascending: false })
    // Without this the lines come back in whatever order Postgres chose, which
    // reshuffles between reads. Route order would suit the room better, but
    // order_lines has no position column — and History is where you look one
    // thing up, which is what alphabetical is for.
    .order('ingredient_name', { referencedTable: 'order_lines' })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data as Order[]
}
