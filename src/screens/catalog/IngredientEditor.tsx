import { useState } from 'react'
import {
  dangerButton,
  input,
  primaryButton,
  quietButton,
  secondaryButton,
} from '../../components/styles'
import type { IngredientInput } from '../../data/catalog'
import type { Catalog, Ingredient } from '../../types'

type Props = {
  catalog: Catalog
  /** null when adding. */
  ingredient: Ingredient | null
  defaultLocationId: string
  onSave: (values: IngredientInput, dishIds: string[]) => void
  onCancel: () => void
  onToggleArchived?: () => void
  onDelete?: () => void
}

export function IngredientEditor({
  catalog,
  ingredient,
  defaultLocationId,
  onSave,
  onCancel,
  onToggleArchived,
  onDelete,
}: Props) {
  const [name, setName] = useState(ingredient?.name ?? '')
  const [unit, setUnit] = useState(ingredient?.unit ?? '')
  const [locationId, setLocationId] = useState(ingredient?.location_id ?? defaultLocationId)
  const [supplierId, setSupplierId] = useState(ingredient?.supplier_id ?? '')
  const [dishIds, setDishIds] = useState<string[]>(() =>
    ingredient
      ? catalog.dishIngredients
          .filter((di) => di.ingredient_id === ingredient.id)
          .map((di) => di.dish_id)
      : [],
  )

  const toggleDish = (id: string) =>
    setDishIds((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]))

  function submit() {
    if (!name.trim() || !locationId) return
    onSave(
      {
        name: name.trim(),
        unit: unit.trim(),
        location_id: locationId,
        supplier_id: supplierId || null,
      },
      dishIds,
    )
  }

  return (
    <div className="border-b border-rule bg-sand px-3 py-4">
      <label className="block text-base text-stone">
        Name
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Cream 35%"
          className={`${input} mt-1`}
        />
      </label>

      <label className="mt-3 block text-base text-stone">
        Unit
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="l, kg, block, tray, bag"
          className={`${input} mt-1`}
        />
      </label>

      <label className="mt-3 block text-base text-stone">
        Location
        <select
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          className={`${input} mt-1`}
        >
          {catalog.locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-3 block text-base text-stone">
        Supplier
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className={`${input} mt-1`}
        >
          <option value="">None</option>
          {catalog.suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      {catalog.dishes.length > 0 && (
        <div className="mt-4">
          <p className="text-base text-stone">Dishes</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {catalog.dishes.map((dish) => {
              const on = dishIds.includes(dish.id)
              return (
                <button
                  key={dish.id}
                  type="button"
                  onClick={() => toggleDish(dish.id)}
                  className={`min-h-[44px] rounded-full border px-4 text-base ${
                    on
                      ? 'border-ink bg-apricot text-ink'
                      : 'border-rule text-ink'
                  }`}
                >
                  {dish.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-5 flex items-center gap-2">
        <button type="button" onClick={submit} disabled={!name.trim()} className={primaryButton}>
          Save
        </button>
        <button type="button" onClick={onCancel} className={secondaryButton}>
          Cancel
        </button>
        {onToggleArchived && (
          <button type="button" onClick={onToggleArchived} className={`${quietButton} ml-auto`}>
            {ingredient?.archived ? 'Restore' : 'Archive'}
          </button>
        )}
        {onDelete && (
          <button type="button" onClick={onDelete} className={dangerButton}>
            Delete
          </button>
        )}
      </div>

      {onDelete && (
        <p className="mt-2 text-base text-stone">
          Archive keeps it out of the way but on past orders. Delete only works if it has
          never been ordered.
        </p>
      )}
    </div>
  )
}
