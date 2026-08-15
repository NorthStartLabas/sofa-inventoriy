import { Link } from 'react-router-dom'
import { useOrderSend } from '../basket/useOrderSend'
import { ScreenHeader } from '../components/ScreenHeader'
import { Stepper } from '../components/Stepper'
import {
  columnWidth,
  headerLink,
  primaryButton,
  quietButton,
  secondaryButton,
} from '../components/styles'
import { orderText, whatsappUrl } from '../lib/orderText'

/**
 * The basket in full: every group, per-supplier export, and Finish. On a wide
 * screen `BasketPane` shows the same basket beside the Order screen — both
 * render `useOrderSend`, which owns the send itself, so there is only ever one
 * implementation of the part that must not go wrong.
 */
export function BasketScreen() {
  const {
    groups,
    text,
    lineCount,
    loading,
    error,
    unsavedCount,
    setQuantity,
    confirming,
    setConfirming,
    sending,
    copied,
    copy,
    finish,
  } = useOrderSend()

  return (
    <div className="bg-paper">
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

      <div className={`mx-auto min-h-screen ${columnWidth} bg-surface pb-40 md:border-x md:border-line`}>
        {error && (
          <p className="border-y border-bad/30 bg-bad-bg px-4 py-3 text-base text-bad">
            {error}
          </p>
        )}

        {loading ? (
          <p className="px-4 py-8 text-base text-ink-2">Loading…</p>
        ) : lineCount === 0 ? (
          <p className="px-4 py-8 text-base text-ink-2">
            Nothing in the basket yet.{' '}
            <Link to="/" className="underline underline-offset-4">
              Walk the route
            </Link>
            .
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.key}>
              <h2 className="sticky top-0 z-10 flex items-center gap-2 border-y border-line bg-paper px-4 py-2">
                <span className="label text-base text-ink">{group.heading}</span>
                <span className="flex-1 truncate text-base text-ink-2 tabular-nums">
                  {group.lines.length}
                  {/* The heading says the location, because that's what belongs
                      in a message to an outside supplier. This is the half that
                      only the kitchen needs, so it stays on the screen. */}
                  {group.needsSupplier && <span className="ml-2">· no supplier yet</span>}
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
                    className="flex items-center gap-2 border-b border-line bg-surface py-1.5 pr-2 pl-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-ink">
                        {line.name}
                        {/* Archived stock shouldn't normally be ordered, but it
                            can sit in the basket from before it was archived. */}
                        {line.archived && (
                          <span className="label ml-2 text-base font-normal text-bad">archived</span>
                        )}
                      </p>
                      <p className="text-base text-ink-2">{line.addedBy ?? ''}</p>
                    </div>

                    <Stepper
                      quantity={line.quantity}
                      unit={line.unit}
                      onChange={(next) => setQuantity(line.ingredientId, next)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      {lineCount > 0 && (
        <div className="lift-2 fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
          <div
            className={`mx-auto ${columnWidth} px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]`}
          >
            {confirming ? (
              <>
                <p className="text-base font-semibold text-ink">
                  Send {lineCount} {lineCount === 1 ? 'item' : 'items'} and empty the basket?
                </p>
                <p className="mt-1 text-base text-ink-2">
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
                  disabled={unsavedCount > 0}
                  className={`${primaryButton} flex-1`}
                >
                  {unsavedCount > 0 ? 'Not saved yet' : 'Finish'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
