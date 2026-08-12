import { useState, type FormEvent } from 'react'
import { primaryButton } from '../components/styles'
import { useAuth } from './authContext'

export function SignIn() {
  const { sendMagicLink, callbackError } = useAuth()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || sending) return
    setSending(true)
    setError(null)
    const { error } = await sendMagicLink(email)
    setSending(false)
    if (error) setError(error)
    else setSent(true)
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      {/* The same rail the route runs on, used here as the cover of the list. */}
      <div className="border-l-[3px] border-ink pl-4">
        <h1 className="label text-5xl leading-[0.95] tracking-[0.005em] text-ink">
          Kitchen
          <br />
          orders
        </h1>
        <p className="mt-3 text-base text-stone">Two people, one list.</p>
      </div>

      {sent ? (
        <div className="mt-10 border-l-2 border-rule pl-4">
          <p className="text-base font-semibold text-ink">Link sent to {email}</p>
          <p className="mt-1 text-base text-stone">
            Open it on this phone, in this browser, so the session lands in the right place.
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="mt-4 min-h-[44px] text-base font-medium text-ink underline underline-offset-4"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-10">
          <label htmlFor="email" className="label text-base text-stone">
            Email
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="off"
            autoCorrect="off"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@restaurant.com"
            className="mt-1 min-h-[52px] w-full rounded-md border border-rule bg-surface px-4 text-base text-ink outline-none placeholder:text-stone focus:border-ink"
          />
          <button
            type="submit"
            disabled={sending}
            className={`${primaryButton} mt-3 min-h-[52px] w-full`}
          >
            {sending ? 'Sending…' : 'Send me a link'}
          </button>
        </form>
      )}

      {(error ?? callbackError) && (
        <p className="mt-4 border-l-2 border-flag pl-4 text-base text-flag">
          {error ?? callbackError}
        </p>
      )}
    </div>
  )
}
