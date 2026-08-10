import { supabase } from '../lib/supabase'

export type OrderLine = {
  id: string
  order_id: string
  ingredient_id: string
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
    .limit(limit)
  if (error) throw new Error(error.message)
  return data as Order[]
}
