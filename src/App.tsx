import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/authContext'
import { SignIn } from './auth/SignIn'
import { BasketProvider } from './basket/BasketProvider'
import { CatalogProvider } from './data/CatalogProvider'
import { BasketScreen } from './screens/BasketScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { OrderScreen } from './screens/OrderScreen'
import { CatalogScreen } from './screens/catalog/CatalogScreen'

function Gate() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-base text-neutral-500">
        Loading…
      </div>
    )
  }

  if (!session) return <SignIn />

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
