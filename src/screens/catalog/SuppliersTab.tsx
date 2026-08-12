import { useState } from 'react'
import { dangerButton, input, primaryButton } from '../../components/styles'
import { createSupplier, deleteSupplier, renameSupplier } from '../../data/catalog'
import type { CatalogStore } from '../../data/useCatalog'
import type { Supplier } from '../../types'

export function SuppliersTab({ store }: { store: CatalogStore }) {
  const { catalog, setCatalog, mutate, run } = store
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const countFor = (id: string) =>
    catalog.ingredients.filter((i) => i.supplier_id === id && !i.archived).length

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

  return (
    <div className="px-4 py-4">
      <p className="mb-4 text-base text-stone">
        Suppliers are only used to group the basket when you send the order.
      </p>

      {catalog.suppliers.map((supplier) => (
        <div
          key={supplier.id}
          className="flex items-center gap-2 border-b border-rule py-2"
        >
          {editing === supplier.id ? (
            <>
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveRename(supplier)}
                className={input}
              />
              <button type="button" onClick={() => saveRename(supplier)} className={primaryButton}>
                Save
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setDraft(supplier.name)
                  setEditing(supplier.id)
                }}
                className="min-h-[44px] flex-1 text-left text-base font-medium"
              >
                {supplier.name}
                <span className="ml-2 font-normal text-stone">{countFor(supplier.id)}</span>
              </button>
              <button type="button" onClick={() => remove(supplier)} className={dangerButton}>
                Delete
              </button>
            </>
          )}
        </div>
      ))}

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
