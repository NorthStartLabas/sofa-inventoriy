import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchCatalog } from './catalog'
import { emptyCatalog, type Catalog } from '../types'

export type CatalogStore = {
  catalog: Catalog
  setCatalog: React.Dispatch<React.SetStateAction<Catalog>>
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  /**
   * Apply a change locally, then persist it. The Catalog screen is edited by
   * one person at a time on a good connection, so on failure we say so and
   * re-read the server rather than trying to reconcile.
   */
  mutate: (optimistic: (c: Catalog) => Catalog, persist: () => Promise<void>) => Promise<void>
  /** For inserts, where the id only exists once the server has replied. */
  run: (work: () => Promise<void>) => Promise<void>
  /**
   * The catalog as of *now*, not as of the last render. Needed when a handler
   * has to derive its write from the current set — React runs state updaters
   * during render, long after the handler has already sent the request.
   */
  getCatalog: () => Catalog
}

export function useCatalog(): CatalogStore {
  const [catalog, setCatalog] = useState<Catalog>(emptyCatalog)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Re-synced every render, and eagerly inside mutate() so back-to-back
  // handlers in the same tick don't each read the pre-change state.
  const catalogRef = useRef(catalog)
  catalogRef.current = catalog
  const getCatalog = useCallback(() => catalogRef.current, [])

  const reload = useCallback(async () => {
    try {
      const fresh = await fetchCatalog()
      catalogRef.current = fresh
      setCatalog(fresh)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the catalog.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const mutate = useCallback<CatalogStore['mutate']>(
    async (optimistic, persist) => {
      catalogRef.current = optimistic(catalogRef.current)
      setCatalog(catalogRef.current)
      setError(null)
      try {
        await persist()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'That change did not save.')
        await reload()
      }
    },
    [reload],
  )

  const run = useCallback<CatalogStore['run']>(async (work) => {
    setError(null)
    try {
      await work()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That change did not save.')
    }
  }, [])

  return { catalog, setCatalog, loading, error, reload, mutate, run, getCatalog }
}
