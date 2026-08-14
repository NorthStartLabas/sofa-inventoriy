import { Link } from 'react-router-dom'
import { useOrderSend } from '../../basket/useOrderSend'
import { Stepper } from '../../components/Stepper'
import { primaryButton, quietButton, secondaryButton } from '../../components/styles'
import { whatsappUrl } from '../../lib/orderText'

/**
 * The basket, alongside the route instead of behind a tap.
 *
 * On a phone the basket is a bar at the bottom and a screen of its own, because
 * 390px has room for one thing at a time. A tablet on the pass, or a laptop in
 * the office, has room for both — and seeing what you've already got while you
 * walk the list is the whole reason to use the bigger screen.
 *
 * Hidden below `lg`; the bar and the screen are unchanged there.
 *
 * Rows are two lines rather than one. The stepper is 160px of controls that
 * can't shrink — it's the same one as on the Order screen, because this is
 * where you'd adjust a number you just realised was wrong — and putting the
 * name beside it in a 320px column leaves nothing to read.
 */
export function BasketPane() {
  const send = useOrderSend()

  return (
    <aside
      // self-start is load-bearing: a flex child stretches to the row's full
      // height by default, and something full-height can never stick.
      className="sticky top-0 hidden max-h-screen w-80 shrink-0 flex-col self-start border-r border-rule bg-sand lg:flex xl:w-96"
    >
      <div className="flex items-baseline gap-2 border-b border-rule px-3 py-2">
        <span className="label flex-1 text-base text-ink">Basket</span>
        <span className="text-base text-stone tabular-nums">{send.lineCount}</span>
      </div>

      {/* Only this pane's own failures. A basket error is already reported at
          the top of the column beside it, and saying it twice reads as two. */}
      {send.failure && (
        <p className="border-b border-flag/30 bg-flag-wash px-3 py-2 text-base text-flag">
          {send.failure}
        </p>
      )}

      {/* min-h-0 is what lets this scroll inside the flex column rather than
          pushing the actions off the bottom of the screen. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {send.loading ? (
          <p className="px-3 py-6 text-base text-stone">Loading…</p>
        ) : send.lineCount === 0 ? (
          <p className="px-3 py-6 text-base text-stone">
            Nothing yet. Step a quantity on the left and it shows up here.
          </p>
        ) : (
          send.groups.map((group) => (
            <section key={group.key}>
              <h2 className="sticky top-0 z-10 flex items-baseline gap-2 border-b border-rule bg-sand px-3 py-2">
                <span className="label flex-1 truncate text-base text-ink">{group.heading}</span>
                {group.needsSupplier && (
                  <span className="shrink-0 text-base text-stone">no supplier</span>
                )}
              </h2>

              <ul>
                {group.lines.map((line) => (
                  <li key={line.ingredientId} className="border-b border-rule bg-surface px-3 py-2">
                    <p className="truncate text-base font-medium text-ink">
                      {line.name}
                      {line.archived && (
                        <span className="label ml-2 text-base font-normal text-flag">archived</span>
                      )}
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="truncate text-base text-stone">{line.addedBy ?? ''}</span>
                      <Stepper
                        quantity={line.quantity}
                        unit={line.unit}
                        onChange={(next) => send.setQuantity(line.ingredientId, next)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      {send.lineCount > 0 && (
        <div className="border-t border-rule bg-surface px-3 py-3">
          {send.confirming ? (
            <>
              <p className="text-base font-semibold text-ink">
                Send {send.lineCount} {send.lineCount === 1 ? 'item' : 'items'} and empty the
                basket?
              </p>
              <p className="mt-1 text-base text-stone">It stays in History either way.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={send.finish}
                  disabled={send.sending}
                  className={`${primaryButton} flex-1`}
                >
                  {send.sending ? 'Finishing…' : 'Yes, finish it'}
                </button>
                <button
                  type="button"
                  onClick={() => send.setConfirming(false)}
                  disabled={send.sending}
                  className={secondaryButton}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => send.copy(send.text, 'all')}
                  className={quietButton}
                >
                  {send.copied === 'all' ? 'Copied' : 'Copy'}
                </button>
                <a
                  href={whatsappUrl(send.text)}
                  target="_blank"
                  rel="noreferrer"
                  className={`${quietButton} leading-[44px]`}
                >
                  WhatsApp
                </a>
                {/* The full screen still exists at this width, and it's where
                    the per-supplier Copy and Send buttons live. */}
                <Link to="/basket" className={`${quietButton} ml-auto leading-[44px]`}>
                  Open →
                </Link>
              </div>
              <button
                type="button"
                onClick={() => send.setConfirming(true)}
                disabled={send.unsavedCount > 0}
                className={`${primaryButton} mt-2 w-full`}
              >
                {send.unsavedCount > 0 ? 'Not saved yet' : 'Finish'}
              </button>
            </>
          )}
        </div>
      )}
    </aside>
  )
}
