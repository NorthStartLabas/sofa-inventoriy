import { createContext, useContext } from 'react'
import type { CatalogStore } from './useCatalog'

export const CatalogContext = createContext<CatalogStore | null>(null)

export function useCatalogStore(): CatalogStore {
  const ctx = useContext(CatalogContext)
  if (!ctx) throw new Error('useCatalogStore must be used inside <CatalogProvider>')
  return ctx
}
