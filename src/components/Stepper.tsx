import { useEffect, useRef, useState } from 'react'
import { formatQuantity } from '../data/basket'

type Props = {
  quantity: number
  unit: string
  onChange: (quantity: number) => void
}

/**
 * Big −/+ buttons, no keyboard. Tapping the number itself opens a numeric
 * field as a deliberate secondary path — the primary control has to work with
 * wet hands and no aim.
 */
export function Stepper({ quantity, unit, onChange }: Props) {
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (typing) inputRef.current?.select()
  }, [typing])

  function commit() {
    setTyping(false)
    // An empty box means "I tapped this by accident" — not zero. Committing
    // Number('') would silently drop the line out of the basket.
    if (draft.trim() === '') return
    const parsed = Number(draft.replace(',', '.'))
    if (Number.isFinite(parsed)) onChange(parsed)
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Decrease"
        disabled={quantity <= 0}
        onClick={() => onChange(quantity - 1)}
        className="h-11 w-11 shrink-0 rounded-lg border border-neutral-300 text-2xl leading-none font-medium text-neutral-900 disabled:border-neutral-200 disabled:text-neutral-300"
      >
        −
      </button>

      {typing ? (
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setTyping(false)
          }}
          autoFocus
          className="h-11 w-16 rounded-lg border border-neutral-900 text-center text-base outline-none"
        />
      ) : (
        <button
          type="button"
          aria-label="Type a quantity"
          onClick={() => {
            setDraft(quantity > 0 ? formatQuantity(quantity) : '')
            setTyping(true)
          }}
          className="h-11 w-16 shrink-0 text-center text-base font-semibold tabular-nums"
        >
          {/* Empty rather than a dash at zero — a second grey dash next to the
              disabled minus just reads as two broken buttons. */}
          {quantity > 0 && (
            <>
              {formatQuantity(quantity)}
              {unit && <span className="ml-1 font-normal text-neutral-500">{unit}</span>}
            </>
          )}
        </button>
      )}

      <button
        type="button"
        aria-label="Increase"
        onClick={() => onChange(quantity + 1)}
        className="h-11 w-11 shrink-0 rounded-lg border border-neutral-300 text-2xl leading-none font-medium text-neutral-900"
      >
        +
      </button>
    </div>
  )
}
