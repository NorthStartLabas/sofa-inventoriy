import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCatalogStore } from '../data/catalogContext'
import { finishOrder } from '../data/orders'
import { useDisplayName } from '../lib/displayName'
import { groupBasket, orderText } from '../lib/orderText'
import { useBasket } from './basketContext'

/**
 * Everything needed to look at the basket and send it, so the two places that
 * do — the Basket screen, and the pane beside the Order screen on a wide one —
 * are two renderings of one behaviour rather than two implementations of it.
 *
 * `finish()` is the reason this is a hook and not copied markup. The ordering
 * inside it is load-bearing: `flush()` first, because `finish_order` reads the
 * basket on the *server* and a tap still inside the 400ms debounce would not be
 * there yet; and `flush()` **rejects** when the offline queue won't drain, which
 * has to stop the send rather than be swallowed. A second copy of that is how
 * one copy quietly loses the guard and an order goes out four items short.
 */
export function useOrderSend() {
  const { catalog, loading } = useCatalogStore()
  const basket = useBasket()
  const { name } = useDisplayName()
  const navigate = useNavigate()

  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const groups = useMemo(() => groupBasket(basket.items, catalog), [basket.items, catalog])
  const text = useMemo(() => orderText(groups), [groups])
  const lineCount = groups.reduce((sum, group) => sum + group.lines.length, 0)

  /** `mark` is which button said "Copied" — the whole order, or one group. */
  async function copy(what: string, mark: string) {
    try {
      await navigator.clipboard.writeText(what)
      setCopied(mark)
      window.setTimeout(() => setCopied(null), 2000)
    } catch {
      setFailure('Could not copy. Long-press the list to select it instead.')
    }
  }

  async function finish() {
    setSending(true)
    setFailure(null)
    try {
      await basket.flush()
      await finishOrder(name || null)
      basket.clear()
      navigate('/history')
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Could not finish that order.')
      setConfirming(false)
    } finally {
      setSending(false)
    }
  }

  return {
    groups,
    text,
    lineCount,
    loading: loading || basket.loading,
    /** Something this hook did went wrong — a copy, or a send. */
    failure,
    /** …or the basket itself is unhappy. The pane shows only the former, since
        the column beside it is already reporting the latter. */
    error: failure ?? basket.error,
    /** Taps that haven't reached the server; Finish stays disabled while any do. */
    unsavedCount: basket.unsaved.size,
    setQuantity: basket.setQuantity,
    confirming,
    setConfirming,
    sending,
    copied,
    copy,
    finish,
  }
}
