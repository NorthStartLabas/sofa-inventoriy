import { useState, type FormEvent } from 'react'
import { primaryButton } from '../components/styles'
import { useAuth } from './authContext'
import { useProfile } from './profileContext'

const MIN_LENGTH = 8

/**
 * Choose a password. Reached two ways, and they're the same screen because
 * they're the same job:
 *
 * - a temporary password the owner set and handed over, flagged on the profile;
 * - a reset link, which signs you in for exactly this and nothing else.
 *
 * A screen rather than a dialog, for the reason NamePrompt is one: there's
 * nothing to dismiss, so there's nothing to tap past. No skip — a password
 * somebody else knows is the one thing this screen exists to end.
 */
export function SetPassword() {
  const { updatePassword, signOut } = useAuth()
  const { markPasswordChanged } = useProfile()
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tooShort = password.length > 0 && password.length < MIN_LENGTH
  const mismatch = again.length > 0 && password !== again
  const ready = password.length >= MIN_LENGTH && password === again

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!ready || busy) return
    setBusy(true)
    setError(null)

    const { error } = await updatePassword(password)
    if (error) {
      setBusy(false)
      setError(error)
      return
    }

    try {
      // Only after Supabase accepted the password. Flipping the flag first
      // would wave someone past on the next load with the temporary one still
      // live.
      await markPasswordChanged()
    } catch {
      // The password is genuinely changed; the flag just didn't clear. Say
      // nothing and let it ask once more rather than block on a stale row.
    }
    setBusy(false)
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="border-l-[3px] border-wine pl-4">
        <h1 className="page-title text-6xl text-ink">
          Pick a
          <br />
          password
        </h1>
        <p className="mt-3 text-base text-ink-2">
          The one you were given is known by whoever gave it to you. This one is yours.
        </p>
      </div>

      <form onSubmit={submit} className="mt-10">
        <label htmlFor="new-password" className="label text-base text-ink-2">
          New password
        </label>
        <input
          id="new-password"
          type="password"
          autoFocus
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 min-h-[52px] w-full rounded-[13px] border border-line bg-surface px-4 text-base text-ink outline-none focus:border-wine"
        />

        <label htmlFor="again" className="label mt-4 block text-base text-ink-2">
          Again
        </label>
        <input
          id="again"
          type="password"
          autoComplete="new-password"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
          className="mt-1 min-h-[52px] w-full rounded-[13px] border border-line bg-surface px-4 text-base text-ink outline-none focus:border-wine"
        />

        {/* Kept in the layout so the button doesn't jump as you type. */}
        <p className="mt-2 min-h-[24px] text-base text-ink-2">
          {tooShort
            ? `At least ${MIN_LENGTH} characters.`
            : mismatch
              ? 'Those two don’t match.'
              : 'At least 8 characters. Anything you’ll remember with wet hands.'}
        </p>

        <button
          type="submit"
          disabled={!ready || busy}
          className={`${primaryButton} mt-1 min-h-[52px] w-full`}
        >
          {busy ? 'Saving…' : 'Save it and carry on'}
        </button>
      </form>

      {error && <p className="mt-4 border-l-2 border-bad pl-4 text-base text-bad">{error}</p>}

      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-6 min-h-[44px] self-start text-base text-ink-2 underline underline-offset-4 hover:text-ink"
      >
        Sign out instead
      </button>
    </div>
  )
}
