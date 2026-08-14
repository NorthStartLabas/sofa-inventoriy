import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/authContext'
import { SignIn } from './auth/SignIn'
import { BasketProvider } from './basket/BasketProvider'
import { CatalogProvider } from './data/CatalogProvider'
import { NamePrompt } from './auth/NamePrompt'
import { useDisplayName } from './lib/displayName'
import { BasketScreen } from './screens/BasketScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { OrderScreen } from './screens/order/OrderScreen'
import { CatalogScreen } from './screens/catalog/CatalogScreen'

function Gate() {
  const { session, loading } = useAuth()
  const { name } = useDisplayName()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-base text-stone">
        Loading…
      </div>
    )
  }

  if (!session) return <SignIn />

  // Above the providers and outside the router on purpose: the prompt needs
  // neither catalog nor basket, and nothing routed can be bookmarked past it or
  // rendered behind it. useDisplayName listens for `storage`, so clearing the
  // name anywhere drops every tab back here.
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

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Gate />
      </HashRouter>
    </AuthProvider>
  )
}
