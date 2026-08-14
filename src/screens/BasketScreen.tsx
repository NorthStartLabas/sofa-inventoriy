import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useBasket } from '../basket/basketContext'
import { ScreenHeader } from '../components/ScreenHeader'
import { Stepper } from '../components/Stepper'
import { headerLink, primaryButton, quietButton, secondaryButton } from '../components/styles'
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
  const [copied, setCopied] = useState<string | null>(null)

  const groups = useMemo(() => groupBasket(basket.items, catalog), [basket.items, catalog])
  const text = useMemo(() => orderText(groups), [groups])
  const lineCount = groups.reduce((sum, group) => sum + group.lines.length, 0)

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
      // Any tap still inside the 400ms debounce has to land first — finish_order
      // reads the basket on the server, not from this screen. flush also drains
      // the offline queue and rejects if it can't, which is the point: an order
      // that quietly goes out missing four items is worse than one that waits.
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
    <div className="mx-auto min-h-screen max-w-2xl bg-surface pb-40">
      <ScreenHeader
        title="Basket"
        leading={
          <Link to="/" className={headerLink}>
            ←
          </Link>
        }
      >
        <Link to="/history" className={headerLink}>
          History
        </Link>
      </ScreenHeader>

      {(failure ?? basket.error) && (
        <p className="border-y border-flag/30 bg-flag-wash px-4 py-3 text-base text-flag">
          {failure ?? basket.error}
        </p>
      )}

      {loading || basket.loading ? (
        <p className="px-4 py-8 text-base text-stone">Loading…</p>
      ) : lineCount === 0 ? (
        <p className="px-4 py-8 text-base text-stone">
          Nothing in the basket yet.{' '}
          <Link to="/" className="underline underline-offset-4">
            Walk the route
          </Link>
          .
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.key}>
            <h2 className="sticky top-0 z-10 flex items-center gap-2 border-y border-rule bg-sand px-4 py-2">
              <span className="label text-base text-ink">{group.heading}</span>
              <span className="flex-1 text-base text-stone tabular-nums">
                {group.lines.length}
              </span>
              {/* One message per recipient: the whole-order buttons below are
                  right for one supplier and wrong for three. */}
              {groups.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => copy(orderText([group]), group.key)}
                    className={quietButton}
                  >
                    {copied === group.key ? 'Copied' : 'Copy'}
                  </button>
                  <a
                    href={whatsappUrl(orderText([group]))}
                    target="_blank"
                    rel="noreferrer"
                    className={`${quietButton} leading-[44px]`}
                  >
                    Send
                  </a>
                </>
              )}
            </h2>

            <ul>
              {group.lines.map((line) => (
                <li
                  key={line.ingredientId}
                  className="flex items-center gap-2 border-b border-rule bg-surface py-1.5 pr-2 pl-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-ink">
                      {line.name}
                      {/* Archived stock shouldn't normally be ordered, but it
                          can sit in the basket from before it was archived. */}
                      {line.archived && (
                        <span className="label ml-2 text-base font-normal text-flag">archived</span>
                      )}
                    </p>
                    <p className="text-base text-stone">{line.addedBy ?? ''}</p>
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
        <div className="fixed inset-x-0 bottom-0 border-t border-rule bg-surface/95 backdrop-blur">
          <div className="mx-auto max-w-2xl px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {confirming ? (
              <>
                <p className="text-base font-semibold text-ink">
                  Send {lineCount} {lineCount === 1 ? 'item' : 'items'} and empty the basket?
                </p>
                <p className="mt-1 text-base text-stone">
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
                <button
                  type="button"
                  onClick={() => copy(text, 'all')}
                  className={secondaryButton}
                >
                  {copied === 'all' ? 'Copied' : 'Copy'}
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
                  disabled={basket.unsaved.size > 0}
                  className={`${primaryButton} flex-1`}
                >
                  {basket.unsaved.size > 0 ? 'Not saved yet' : 'Finish'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
