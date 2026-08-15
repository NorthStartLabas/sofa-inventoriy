import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/authContext'
import { ScreenHeader } from '../../components/ScreenHeader'
// `tab` is the selected-tab state in this file, so the style helper takes the alias.
import { columnWidth, headerLink, tab as tabStyle } from '../../components/styles'
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
    <div className="bg-paper">
      <ScreenHeader
        title="Catalog"
        leading={
          <Link to="/" className={headerLink}>
            ←
          </Link>
        }
      >
        <button type="button" onClick={signOut} className={headerLink}>
          Sign out
        </button>
      </ScreenHeader>

      {/* One column at every width, on purpose. ReorderList measures every row
          edge once at drag start, in document space, and autoscrolls `window` —
          so a grid, or a pane with its own scrollbar, breaks dragging in a way
          that only shows up when someone tries to reorder the route. Wider is
          safe here; re-flowed is not. */}
      <div className={`mx-auto min-h-screen ${columnWidth} bg-surface md:border-x md:border-line`}>
        <div className="lift sticky top-0 z-40 flex border-b border-line bg-surface">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-current={tab === t}
              className={tabStyle(tab === t)}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Sticky under the tab row: a refused delete happens far down a long list,
            and an explanation pinned to the top of the page is one nobody reads.
            z-50 puts it over the section headers, which are sticky at the same
            offset — when both want the band, the error wins. */}
        {store.error && (
          <p className="sticky top-[45px] z-50 border-y border-bad/30 bg-bad-bg px-4 py-3 text-base text-bad">
            {store.error}
          </p>
        )}

        {store.loading ? (
          <p className="px-4 py-8 text-base text-ink-2">Loading…</p>
        ) : (
          <>
            {tab === 'Ingredients' && <IngredientsTab store={store} />}
            {tab === 'Dishes' && <DishesTab store={store} />}
            {tab === 'Locations' && <LocationsTab store={store} />}
            {tab === 'Suppliers' && <SuppliersTab store={store} />}
          </>
        )}
      </div>
    </div>
  )
}
