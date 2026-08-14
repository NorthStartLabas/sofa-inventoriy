import { useState } from 'react'
import { dangerButton, input, primaryButton, secondaryButton } from '../../components/styles'
import {
  createSupplier,
  deleteSupplier,
  renameSupplier,
  setIngredientsForSupplier,
} from '../../data/catalog'
import type { CatalogStore } from '../../data/useCatalog'
import { normalize } from '../../lib/orderView'
import type { Supplier } from '../../types'

export function SuppliersTab({ store }: { store: CatalogStore }) {
  const { catalog, setCatalog, mutate, run, getCatalog } = store
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [draft, setDraft] = useState('')

  const countFor = (id: string) =>
    catalog.ingredients.filter((i) => i.supplier_id === id && !i.archived).length

  const supplierNames = new Map(catalog.suppliers.map((s) => [s.id, s.name]))

  function add() {
    const name = newName.trim()
    if (!name) return
    setNewName('')
    void run(async () => {
      const created = await createSupplier(name)
      setCatalog((c) => ({
        ...c,
        suppliers: [...c.suppliers, created].sort((a, b) => a.name.localeCompare(b.name)),
      }))
    })
  }

  function saveRename(supplier: Supplier) {
    const name = draft.trim()
    setEditing(null)
    if (!name || name === supplier.name) return
    void mutate(
      (c) => ({
        ...c,
        suppliers: c.suppliers
          .map((s) => (s.id === supplier.id ? { ...s, name } : s))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }),
      () => renameSupplier(supplier.id, name),
    )
  }

  function remove(supplier: Supplier) {
    void mutate(
      (c) => ({
        ...c,
        suppliers: c.suppliers.filter((s) => s.id !== supplier.id),
        // Matches the on delete set null on the foreign key.
        ingredients: c.ingredients.map((i) =>
          i.supplier_id === supplier.id ? { ...i, supplier_id: null } : i,
        ),
      }),
      () => deleteSupplier(supplier.id),
    )
  }

  function toggleIngredient(supplierId: string, ingredientId: string) {
    // Read through getCatalog, not this render's `catalog`: setIngredientsForSupplier
    // replaces the supplier's whole set, so a second tap landing before the
    // re-render would compute from a stale snapshot and undo the first one.
    // Ticking a whole shelf in a row is exactly the intended use here.
    const current = getCatalog()
      .ingredients.filter((i) => i.supplier_id === supplierId)
      .map((i) => i.id)
    const next = current.includes(ingredientId)
      ? current.filter((id) => id !== ingredientId)
      : [...current, ingredientId]

    void mutate(
      (c) => ({
        ...c,
        ingredients: c.ingredients.map((i) =>
          next.includes(i.id)
            ? { ...i, supplier_id: supplierId }
            : // Clearing only this supplier's dropped rows — an ingredient
              // assigned to someone else keeps them.
              i.supplier_id === supplierId
              ? { ...i, supplier_id: null }
              : i,
        ),
      }),
      () => setIngredientsForSupplier(supplierId, next),
    )
  }

  return (
    <div className="px-4 py-4">
      <p className="mb-4 text-base text-stone">
        Suppliers group the basket and split the message, so each one gets only its own
        list. Open a supplier to tick off everything it delivers.
      </p>

      {catalog.suppliers.map((supplier) => {
        const open = expanded === supplier.id
        const term = normalize(filter)

        return (
          <div key={supplier.id} className="border-b border-rule">
            <div className="flex items-center gap-2 py-2">
              {editing === supplier.id ? (
                <>
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveRename(supplier)}
                    className={input}
                  />
                  <button
                    type="button"
                    onClick={() => saveRename(supplier)}
                    className={primaryButton}
                  >
                    Save
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setExpanded(open ? null : supplier.id)
                      setFilter('')
                    }}
                    className="min-h-[44px] flex-1 text-left text-base font-medium"
                  >
                    {supplier.name}
                    <span className="ml-2 font-normal text-stone">{countFor(supplier.id)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(supplier.name)
                      setEditing(supplier.id)
                    }}
                    className={secondaryButton}
                  >
                    Rename
                  </button>
                  <button type="button" onClick={() => remove(supplier)} className={dangerButton}>
                    Delete
                  </button>
                </>
              )}
            </div>

            {open && (
              <div className="pb-4">
                {/* 169 checkboxes is a lot to scroll past to reach one of them. */}
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Find an ingredient"
                  autoCapitalize="off"
                  autoCorrect="off"
                  className={input}
                />

                {catalog.locations.map((location) => {
                  const items = catalog.ingredients
                    .filter(
                      (i) =>
                        i.location_id === location.id &&
                        !i.archived &&
                        (term === '' || normalize(i.name).includes(term)),
                    )
                    .sort((a, b) => a.sort_order - b.sort_order)
                  if (items.length === 0) return null

                  return (
                    <div key={location.id} className="mt-2">
                      <p className="label text-base text-stone">{location.name}</p>
                      {items.map((ingredient) => {
                        const mine = ingredient.supplier_id === supplier.id
                        // An ingredient has one supplier, so ticking it here
                        // takes it off whoever had it. Say whose it is now, so
                        // that's a decision rather than a surprise.
                        const heldBy =
                          !mine && ingredient.supplier_id
                            ? supplierNames.get(ingredient.supplier_id)
                            : null

                        return (
                          <label
                            key={ingredient.id}
                            className="flex min-h-[44px] items-center gap-3 text-base"
                          >
                            <input
                              type="checkbox"
                              checked={mine}
                              onChange={() => toggleIngredient(supplier.id, ingredient.id)}
                              className="h-5 w-5"
                            />
                            {ingredient.name}
                            {heldBy && <span className="text-stone">→ {heldBy}</span>}
                          </label>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {catalog.suppliers.length === 0 && (
        <p className="py-6 text-base text-stone">No suppliers yet.</p>
      )}

      <div className="mt-6 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Supplier name"
          className={input}
        />
        <button type="button" onClick={add} disabled={!newName.trim()} className={primaryButton}>
          Add
        </button>
      </div>
    </div>
  )
}
