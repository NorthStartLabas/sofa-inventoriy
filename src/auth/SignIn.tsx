import { useState, type FormEvent } from 'react'
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
      <h1 className="text-3xl font-semibold tracking-tight">Kitchen orders</h1>
      <p className="mt-2 text-base text-neutral-600">
        Enter your email and we'll send you a link to sign in.
      </p>

      {sent ? (
        <div className="mt-8 rounded-xl bg-neutral-100 p-5">
          <p className="text-base font-medium">Link sent to {email}</p>
          <p className="mt-1 text-base text-neutral-600">
            Open it on this phone, in this browser, so the session lands in the right place.
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="mt-4 min-h-[44px] text-base font-medium text-neutral-900 underline underline-offset-4"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="off"
            autoCorrect="off"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@restaurant.com"
            className="min-h-[52px] w-full rounded-xl border border-neutral-300 px-4 text-base outline-none focus:border-neutral-900"
          />
          <button
            type="submit"
            disabled={sending}
            className="mt-3 min-h-[52px] w-full rounded-xl bg-neutral-900 text-base font-semibold text-white disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send me a link'}
          </button>
        </form>
      )}

      {(error ?? callbackError) && (
        <p className="mt-4 text-base text-red-700">{error ?? callbackError}</p>
      )}
    </div>
  )
}
