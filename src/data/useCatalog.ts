import { useCallback, useEffect, useState } from 'react'
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
}

export function useCatalog(): CatalogStore {
  const [catalog, setCatalog] = useState<Catalog>(emptyCatalog)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setCatalog(await fetchCatalog())
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
      setCatalog(optimistic)
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

  return { catalog, setCatalog, loading, error, reload, mutate, run }
}
