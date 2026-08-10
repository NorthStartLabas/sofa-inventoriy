import { useState } from 'react'
import { ReorderList } from '../../components/ReorderList'
import { dangerButton, input, primaryButton, quietButton } from '../../components/styles'
import {
  createLocation,
  deleteLocation,
  persistOrder,
  renameLocation,
} from '../../data/catalog'
import type { CatalogStore } from '../../data/useCatalog'
import type { Location } from '../../types'

export function LocationsTab({ store }: { store: CatalogStore }) {
  const { catalog, setCatalog, mutate, run } = store
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const locations = catalog.locations

  // Counted separately because only the *total* decides whether delete works —
  // showing the active count alone made a location read "0" and still refuse.
  const countsFor = (id: string) => {
    const here = catalog.ingredients.filter((i) => i.location_id === id)
    return { active: here.filter((i) => !i.archived).length, archived: here.filter((i) => i.archived).length }
  }

  function reorder(ids: string[]) {
    void mutate(
      (c) => ({
        ...c,
        locations: ids.map((id, index) => ({
          ...c.locations.find((l) => l.id === id)!,
          sort_order: index,
        })),
      }),
      () => persistOrder('locations', ids),
    )
  }

  function add() {
    const name = newName.trim()
    if (!name) return
    setNewName('')
    void run(async () => {
      const created = await createLocation(name, locations.length)
      setCatalog((c) => ({ ...c, locations: [...c.locations, created] }))
    })
  }

  function saveRename(location: Location) {
    const name = draft.trim()
    setEditing(null)
    if (!name || name === location.name) return
    void mutate(
      (c) => ({
        ...c,
        locations: c.locations.map((l) => (l.id === location.id ? { ...l, name } : l)),
      }),
      () => renameLocation(location.id, name),
    )
  }

  function remove(location: Location) {
    void mutate(
      (c) => ({ ...c, locations: c.locations.filter((l) => l.id !== location.id) }),
      () => deleteLocation(location.id),
    )
  }

  return (
    <div className="px-4 py-4">
      <p className="mb-4 text-base text-steel">
        The order here is the walking route through the kitchen. Drag to match how you
        actually move.
      </p>

      <ReorderList
        items={locations}
        getId={(l) => l.id}
        onReorder={reorder}
        hideHandle={(l) => editing === l.id}
        renderRow={(location) => (
          <div className="flex items-center gap-2 border-b border-rule py-2">
            {editing === location.id ? (
              <>
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveRename(location)}
                  className={input}
                />
                <button type="button" onClick={() => saveRename(location)} className={primaryButton}>
                  Save
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(location.name)
                    setEditing(location.id)
                  }}
                  className="min-h-[44px] flex-1 text-left text-base font-medium"
                >
                  {location.name}
                  <span className="ml-2 font-normal text-steel">
                    {countsFor(location.id).active}
                    {countsFor(location.id).archived > 0 &&
                      ` +${countsFor(location.id).archived} archived`}
                  </span>
                </button>
                <button type="button" onClick={() => remove(location)} className={dangerButton}>
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      />

      {locations.length === 0 && (
        <p className="py-6 text-base text-steel">
          No locations yet. Add the first section of your kitchen below.
        </p>
      )}

      <div className="mt-6 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Cooler, Freezer, Dry store…"
          className={input}
        />
        <button type="button" onClick={add} disabled={!newName.trim()} className={primaryButton}>
          Add
        </button>
      </div>

      <p className={`${quietButton} px-0`}>
        Deleting a location only works once nothing lives there — archived included.
      </p>
    </div>
  )
}
