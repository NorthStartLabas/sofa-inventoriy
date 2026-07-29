import type { ReactNode } from 'react'
import { CatalogContext } from './catalogContext'
import { useCatalog } from './useCatalog'

/**
 * The catalog is read by both the Order screen and the Catalog screen, and it
 * changes rarely. One fetch, shared, rather than one per screen.
 */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const store = useCatalog()
  return <CatalogContext.Provider value={store}>{children}</CatalogContext.Provider>
}
