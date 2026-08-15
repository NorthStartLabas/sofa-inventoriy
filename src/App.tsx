import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/authContext'
import { ProfileProvider } from './auth/ProfileProvider'
import { useProfile } from './auth/profileContext'
import { NamePrompt } from './auth/NamePrompt'
import { SetPassword } from './auth/SetPassword'
import { SignIn } from './auth/SignIn'
import { BasketProvider } from './basket/BasketProvider'
import { CatalogProvider } from './data/CatalogProvider'
import { BasketScreen } from './screens/BasketScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { OrderScreen } from './screens/order/OrderScreen'
import { CatalogScreen } from './screens/catalog/CatalogScreen'

function Waiting() {
  return (
    <div className="flex min-h-screen items-center justify-center text-base text-ink-2">
      Loading…
    </div>
  )
}

/**
 * Everything past the session: who you are, and whether you're allowed to get on
 * with it yet.
 *
 * Kept above CatalogProvider and outside the router on purpose. Neither of these
 * screens needs the catalog or the basket, and up here they can't be routed
 * past, bookmarked past, or rendered behind anything.
 */
function Named() {
  const { recovering } = useAuth()
  const { name, mustChangePassword, loading, error } = useProfile()

  if (loading) return <Waiting />

  if (error) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <p className="border-l-2 border-bad pl-4 text-base text-bad">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 min-h-[44px] self-start text-base font-medium text-ink underline underline-offset-4"
        >
          Try again
        </button>
      </div>
    )
  }

  // Password before name: a temporary password is a door standing open, and
  // asking someone their name first would leave it open a screen longer.
  if (mustChangePassword || recovering) return <SetPassword />
  if (!name) return <NamePrompt />

  // Inside the gate: the basket can only be read once there's a session to
  // read it with.
  return (
    <CatalogProvider>
      <BasketProvider>
        <Routes>
          <Route path="/" element={<OrderScreen />} />
          <Route path="/basket" element={<BasketScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/catalog" element={<CatalogScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BasketProvider>
    </CatalogProvider>
  )
}

function Gate() {
  const { session, loading } = useAuth()

  if (loading) return <Waiting />
  if (!session) return <SignIn />

  // Keyed by user id so signing out and back in as someone else rebuilds the
  // profile rather than briefly showing the last person's name.
  return (
    <ProfileProvider key={session.user.id} userId={session.user.id}>
      <Named />
    </ProfileProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Gate />
      </HashRouter>
    </AuthProvider>
  )
}
