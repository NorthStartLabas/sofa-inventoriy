import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/authContext'
import { useDisplayName } from '../lib/displayName'
import { input, quietButton } from './styles'

/**
 * Whose name goes on the lines this phone adds — and, in the same panel, the
 * way out. Both answer "who am I on this phone", and grouping them keeps Sign
 * out one tap from the Order screen without spending header width on it.
 */
export function NameChip() {
  const { name, setName } = useDisplayName()
  const { signOut } = useAuth()
  const [open, setOpen] = useState(false)
  // setName trims, so the field can't write straight through it — a space mid
  // name would vanish as you typed it.
  const [draft, setDraft] = useState('')
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const close = () => {
      setName(draft)
      setOpen(false)
    }
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') close()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, draft, setName])

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => {
          setDraft(name)
          setOpen((was) => !was)
        }}
        className="h-11 rounded-md px-2 text-base text-sand/75"
      >
        {name || 'Set name'}
      </button>

      {open && (
        // Sits above the sticky view switcher, which is z-40.
        <div className="absolute top-full right-0 z-50 mt-1 w-60 rounded-[10px] border border-rule bg-surface p-3 shadow-lg">
          <label className="label block text-base text-stone">
            Your name
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Your name"
              className={`${input} mt-1`}
            />
          </label>

          <div className="mt-2 border-t border-rule pt-1">
            <button
              type="button"
              onClick={() => {
                setName(draft)
                void signOut()
              }}
              className={`${quietButton} w-full px-0 text-left`}
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
