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
