import { useState } from 'react'
import { useDisplayName } from '../lib/displayName'

/** Whose name goes on the lines this phone adds. Tap to change, any time. */
export function NameChip() {
  const { name, setName } = useDisplayName()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setName(draft)
          setEditing(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            setName(draft)
            setEditing(false)
          }
        }}
        placeholder="Your name"
        className="h-11 w-28 rounded-lg border border-neutral-900 px-2 text-base outline-none"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(name)
        setEditing(true)
      }}
      className="h-11 rounded-lg px-2 text-base text-neutral-500"
    >
      {name || 'Set name'}
    </button>
  )
}
