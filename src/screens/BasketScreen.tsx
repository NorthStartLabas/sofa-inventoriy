import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useBasket } from '../basket/basketContext'
import { Stepper } from '../components/Stepper'
import { primaryButton, secondaryButton } from '../components/styles'
import { useCatalogStore } from '../data/catalogContext'
import { finishOrder } from '../data/orders'
import { useDisplayName } from '../lib/displayName'
import { groupBasket, orderText, whatsappUrl } from '../lib/orderText'

export function BasketScreen() {
  const { catalog, loading } = useCatalogStore()
  const basket = useBasket()
  const { name } = useDisplayName()
  const navigate = useNavigate()

  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const groups = useMemo(() => groupBasket(basket.items, catalog), [basket.items, catalog])
  const text = useMemo(() => orderText(groups), [groups])
  const lineCount = groups.reduce((sum, group) => sum + group.lines.length, 0)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setFailure('Could not copy. Long-press the list to select it instead.')
    }
  }

  async function finish() {
    setSending(true)
    setFailure(null)
    try {
      // Any tap still inside the 400ms debounce has to land first — finish_order
      // reads the basket on the server, not from this screen.
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

  return (
    <div className="mx-auto max-w-2xl pb-40">
      <header className="flex items-center gap-2 px-3 py-2">
        <Link to="/" className="h-11 px-1 text-base leading-[44px] text-neutral-500">
          ← Order
        </Link>
        <h1 className="flex-1 text-lg font-semibold">Basket</h1>
        <Link to="/history" className="h-11 px-2 text-base leading-[44px] text-neutral-500">
          History
        </Link>
      </header>

      {(failure ?? basket.error) && (
        <p className="border-y border-red-200 bg-red-50 px-4 py-3 text-base text-red-800">
          {failure ?? basket.error}
        </p>
      )}

      {loading || basket.loading ? (
        <p className="px-4 py-8 text-base text-neutral-500">Loading…</p>
      ) : lineCount === 0 ? (
        <p className="px-4 py-8 text-base text-neutral-500">
          Nothing in the basket yet.{' '}
          <Link to="/" className="underline underline-offset-4">
            Walk the route
          </Link>
          .
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.supplierId ?? 'none'}>
            <h2 className="sticky top-0 z-10 border-y border-neutral-200 bg-neutral-100 px-4 py-2">
              <span className="text-base font-semibold">{group.supplierName}</span>
              <span className="ml-2 text-base text-neutral-500">{group.lines.length}</span>
            </h2>

            <ul>
              {group.lines.map((line) => (
                <li
                  key={line.ingredientId}
                  className="flex items-center gap-2 border-b border-neutral-200 py-1.5 pr-2 pl-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold">
                      {line.name}
                      {/* Archived stock shouldn't normally be ordered, but it
                          can sit in the basket from before it was archived. */}
                      {line.archived && (
                        <span className="ml-2 font-normal text-amber-700">archived</span>
                      )}
                    </p>
                    <p className="text-base text-neutral-500">{line.addedBy ?? ''}</p>
                  </div>

                  <Stepper
                    quantity={line.quantity}
                    unit={line.unit}
                    onChange={(next) => basket.setQuantity(line.ingredientId, next)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {lineCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/95 backdrop-blur">
          <div className="mx-auto max-w-2xl px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {confirming ? (
              <>
                <p className="text-base font-semibold">
                  Send {lineCount} {lineCount === 1 ? 'item' : 'items'} and empty the basket?
                </p>
                <p className="mt-1 text-base text-neutral-500">
                  It stays in History either way.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={finish}
                    disabled={sending}
                    className={`${primaryButton} flex-1`}
                  >
                    {sending ? 'Finishing…' : 'Yes, finish it'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    disabled={sending}
                    className={secondaryButton}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button type="button" onClick={copy} className={secondaryButton}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <a
                  href={whatsappUrl(text)}
                  target="_blank"
                  rel="noreferrer"
                  className={`${secondaryButton} flex-1 text-center leading-[44px]`}
                >
                  WhatsApp
                </a>
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className={`${primaryButton} flex-1`}
                >
                  Finish
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
