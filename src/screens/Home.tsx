import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useDisplayName } from '../lib/displayName'
import { supabase } from '../lib/supabase'

export function Home() {
  const { session, signOut } = useAuth()
  const { name, setName } = useDisplayName()
  const [editingName, setEditingName] = useState(!name)
  const [draft, setDraft] = useState(name)
  const [reachable, setReachable] = useState<'checking' | 'ok' | 'failed'>('checking')

  // Round-trip to Supabase with the stored token, so Phase 1 proves the whole
  // pipeline — build, secrets, auth, network — and not just that React rendered.
  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data, error }) => setReachable(error || !data.user ? 'failed' : 'ok'))
      .catch(() => setReachable('failed'))
  }, [])

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Kitchen orders</h1>
      <p className="mt-2 text-base text-neutral-600">
        Phase 1 — the pipeline works. Screens come next.
      </p>

      <dl className="mt-8 space-y-4">
        <div>
          <dt className="text-base text-neutral-500">Signed in as</dt>
          <dd className="text-base font-medium break-all">{session?.user.email}</dd>
        </div>

        <div>
          <dt className="text-base text-neutral-500">Supabase</dt>
          <dd className="text-base font-medium">
            {reachable === 'checking' && 'Checking…'}
            {reachable === 'ok' && 'Connected'}
            {reachable === 'failed' && 'Not reachable'}
          </dd>
        </div>

        <div>
          <dt className="text-base text-neutral-500">This phone's name</dt>
          <dd className="mt-1">
            {editingName ? (
              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Marco"
                  autoCapitalize="words"
                  className="min-h-[44px] flex-1 rounded-xl border border-neutral-300 px-3 text-base outline-none focus:border-neutral-900"
                />
                <button
                  type="button"
                  onClick={() => {
                    setName(draft)
                    if (draft.trim()) setEditingName(false)
                  }}
                  className="min-h-[44px] rounded-xl bg-neutral-900 px-4 text-base font-semibold text-white"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDraft(name)
                  setEditingName(true)
                }}
                className="min-h-[44px] text-base font-medium underline underline-offset-4"
              >
                {name} — change
              </button>
            )}
          </dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={signOut}
        className="mt-10 min-h-[44px] text-base text-neutral-500 underline underline-offset-4"
      >
        Sign out
      </button>
    </div>
  )
}
