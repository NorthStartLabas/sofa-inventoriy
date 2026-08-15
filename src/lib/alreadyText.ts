import type { Already } from '../basket/alreadyContext'
import { formatQuantity } from '../data/basket'

/** 14:46 — the only part of a timestamp anyone in a kitchen reads. */
export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function amount(quantity: number, unit: string | null): string {
  return unit ? `${formatQuantity(quantity)} ${unit}` : formatQuantity(quantity)
}

/**
 * The one-line version, for a row nobody has tapped yet.
 *
 * Short on purpose. This shares a 390px row with a 160px stepper, so there are
 * roughly 24 characters before it truncates — and a warning cut off at "Raisa
 * has 1 Bus in their…" has spent its whole width on the least useful half of
 * the sentence. Who and how much fit; the clock time and the word "basket" go
 * to the sheet, which is where you're deciding rather than glancing.
 *
 * Sent beats waiting when both are true: an order that has gone out can't be
 * taken back, and a basket still can.
 */
export function summarise(already: Already, unit: string): string {
  const first = already.sent[0]
  if (first) {
    const more = already.sent.length - 1 + already.waiting.length
    return (
      `${first.by} ordered ${amount(first.quantity, first.unit ?? unit)}` +
      (more > 0 ? ` +${more}` : '')
    )
  }

  const waiting = already.waiting[0]
  if (!waiting) return ''
  const more = already.waiting.length - 1
  return `${waiting.name} has ${amount(waiting.quantity, unit)}` + (more > 0 ? ` +${more}` : '')
}
