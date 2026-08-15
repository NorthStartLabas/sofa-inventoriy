import { useState, type FormEvent } from 'react'
import { primaryButton } from '../components/styles'
import { useProfile } from './profileContext'

/**
 * The second half of signing in: which of you is holding this phone.
 *
 * `added_by` is the only thing the name is for, and on a two-person team a line
 * attributed to nobody is a line you have to go and ask about. Nobody was ever
 * asked for a name, so most devices never set one.
 *
 * A screen rather than a dialog over the app. A dimmed, half-visible Order
 * screen invites tapping at it and needs a focus trap to be genuinely
 * inescapable; a screen has nothing to dismiss, which is the same guarantee for
 * none of the work. It borrows SignIn's shape because it is the same moment.
 *
 * This gates the *interface*, never permission — RLS decides what anyone can
 * read or write, and it has never known about this name.
 */
export function NamePrompt() {
  const { setName } = useProfile()
  // setName trims, so the field can't write straight through it — a space
  // mid-name would vanish as you typed it. Same reason as NameChip.
  const [draft, setDraft] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!draft.trim()) return
    // Optimistic inside the provider, so the gate opens on this frame rather
    // than after a round trip. A failure surfaces in the header, not here.
    void setName(draft)
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      {/* The route rail again, the way SignIn uses it — same moment, same cover. */}
      <div className="border-l-[3px] border-wine pl-4">
        <h1 className="page-title text-6xl text-ink">
          Who&rsquo;s
          <br />
          ordering?
        </h1>
        <p className="mt-3 text-base text-ink-2">
          Your name goes on every line you add, so the other person knows who asked for it.
        </p>
      </div>

      <form onSubmit={submit} className="mt-10">
        <label htmlFor="display-name" className="label text-base text-ink-2">
          Name
        </label>
        <input
          id="display-name"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={24}
          autoCapitalize="words"
          autoCorrect="off"
          autoComplete="off"
          placeholder="Sanne"
          className="mt-1 min-h-[52px] w-full rounded-[13px] border border-line bg-surface px-4 text-base text-ink outline-none placeholder:text-ink-2 focus:border-wine"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className={`${primaryButton} mt-3 min-h-[52px] w-full`}
        >
          Continue
        </button>
      </form>

      <p className="mt-6 border-l-2 border-line pl-4 text-base text-ink-2">
        Only on this phone. Change it any time from the header.
      </p>
    </div>
  )
}
