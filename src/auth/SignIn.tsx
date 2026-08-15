import { useState, type FormEvent } from 'react'
import { primaryButton } from '../components/styles'
import { useAuth } from './authContext'

/**
 * Email and password, not a magic link.
 *
 * The link was the problem: on an iPhone with the app on the home screen,
 * tapping it in Mail opens Safari, the session lands there, and the installed
 * app is never signed in at all. A password is typed where you already are.
 *
 * Resetting still goes through email, but that's once in a blue moon rather
 * than every single sign-in.
 */
export function SignIn() {
  const { signIn, sendPasswordReset, callbackError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)

    if (resetting) {
      const { error } = await sendPasswordReset(email)
      setBusy(false)
      if (error) setError(error)
      else setSent(true)
      return
    }

    const { error } = await signIn(email, password)
    setBusy(false)
    if (error) setError(error)
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      {/* The same rail the route runs on, used here as the cover of the list. */}
      <div className="border-l-[3px] border-wine pl-4">
        <h1 className="page-title text-6xl text-ink">
          Kitchen
          <br />
          orders
        </h1>
        <p className="mt-3 text-base text-ink-2">
          {resetting ? 'Send yourself a link to set a new password.' : 'One kitchen, one list.'}
        </p>
      </div>

      {sent ? (
        <div className="mt-10 border-l-2 border-line pl-4">
          <p className="text-base font-semibold text-ink">Link sent to {email}</p>
          <p className="mt-1 text-base text-ink-2">
            Open it on this device. It takes you straight to a screen for picking a new password.
          </p>
          <button
            type="button"
            onClick={() => {
              setSent(false)
              setResetting(false)
            }}
            className="mt-4 min-h-[44px] text-base font-medium text-ink underline underline-offset-4"
          >
            Back to signing in
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-10">
          <label htmlFor="email" className="label text-base text-ink-2">
            Email
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="off"
            autoCorrect="off"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@restaurant.com"
            className="mt-1 min-h-[52px] w-full rounded-[13px] border border-line bg-surface px-4 text-base text-ink outline-none placeholder:text-ink-2 focus:border-wine"
          />

          {!resetting && (
            <>
              <label htmlFor="password" className="label mt-4 block text-base text-ink-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                // So iOS and a password manager both recognise this as the
                // sign-in pair and offer to fill it.
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 min-h-[52px] w-full rounded-[13px] border border-line bg-surface px-4 text-base text-ink outline-none focus:border-wine"
              />
            </>
          )}

          <button
            type="submit"
            disabled={busy}
            className={`${primaryButton} mt-4 min-h-[52px] w-full`}
          >
            {busy ? 'Just a moment…' : resetting ? 'Send the link' : 'Sign in'}
          </button>

          <button
            type="button"
            onClick={() => {
              setResetting((was) => !was)
              setError(null)
            }}
            className="mt-4 min-h-[44px] text-base text-ink-2 underline underline-offset-4 hover:text-ink"
          >
            {resetting ? 'Back to signing in' : 'Forgot your password?'}
          </button>
        </form>
      )}

      {(error ?? callbackError) && (
        <p className="mt-4 border-l-2 border-bad pl-4 text-base text-bad">
          {error ?? callbackError}
        </p>
      )}

      <p className="mt-8 border-l-2 border-line pl-4 text-base text-ink-2">
        No account? They’re made for you — ask Liviu.
      </p>
    </div>
  )
}
