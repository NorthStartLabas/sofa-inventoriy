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
    <div className="mx-auto min-h-screen max-w-2xl bg-surface">
      <header className="flex items-center gap-4 bg-tile px-4 py-3">
        <Link to="/" className="min-h-[44px] py-2 text-base text-steel">
          ← Order
        </Link>
        <h1 className="label flex-1 text-xl">Catalog</h1>
        <button
          type="button"
          onClick={signOut}
          className="min-h-[44px] text-base text-steel"
        >
          Sign out
        </button>
      </header>

      <div className="sticky top-0 z-40 flex border-y border-rule bg-surface px-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`mark min-h-[44px] flex-1 border-b-2 text-base font-medium ${
              tab === t ? 'border-tape text-tape' : 'border-transparent text-steel'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {store.error && (
        <p className="border-b border-flag/30 bg-flag-wash px-4 py-3 text-base text-flag">
          {store.error}
        </p>
      )}

      {store.loading ? (
        <p className="px-4 py-8 text-base text-steel">Loading…</p>
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
