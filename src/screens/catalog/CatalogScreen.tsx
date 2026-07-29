import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/authContext'
import { useCatalogStore } from '../../data/catalogContext'
import { DishesTab } from './DishesTab'
import { IngredientsTab } from './IngredientsTab'
import { LocationsTab } from './LocationsTab'
import { SuppliersTab } from './SuppliersTab'

const TABS = ['Ingredients', 'Dishes', 'Locations', 'Suppliers'] as const
type Tab = (typeof TABS)[number]

export function CatalogScreen() {
  const store = useCatalogStore()
  const { signOut } = useAuth()
  const [tab, setTab] = useState<Tab>('Ingredients')

  return (
    <div className="mx-auto min-h-screen max-w-2xl">
      <header className="flex items-center gap-3 px-4 py-3">
        <Link to="/" className="min-h-[44px] py-2 text-base text-neutral-500">
          ← Order
        </Link>
        <h1 className="flex-1 text-lg font-semibold">Catalog</h1>
        <button
          type="button"
          onClick={signOut}
          className="min-h-[44px] text-base text-neutral-500"
        >
          Sign out
        </button>
      </header>

      <div className="sticky top-0 z-40 flex gap-1 border-b border-neutral-200 bg-white px-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`min-h-[44px] flex-1 border-b-2 px-1 text-base font-medium ${
              tab === t
                ? 'border-neutral-900 text-neutral-900'
                : 'border-transparent text-neutral-500'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {store.error && (
        <p className="border-b border-red-200 bg-red-50 px-4 py-3 text-base text-red-800">
          {store.error}
        </p>
      )}

      {store.loading ? (
        <p className="px-4 py-8 text-base text-neutral-500">Loading…</p>
      ) : (
        <>
          {tab === 'Ingredients' && <IngredientsTab store={store} />}
          {tab === 'Dishes' && <DishesTab store={store} />}
          {tab === 'Locations' && <LocationsTab store={store} />}
          {tab === 'Suppliers' && <SuppliersTab store={store} />}
        </>
      )}
    </div>
  )
}
