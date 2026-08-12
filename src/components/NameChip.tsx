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
        // Sits in the anthracite header, so it carries its own light ground.
        className="h-11 w-28 rounded-md border border-rule bg-surface px-2 text-base text-ink outline-none"
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
      className="h-11 rounded-md px-2 text-base text-sand/75"
    >
      {name || 'Set name'}
    </button>
  )
}
