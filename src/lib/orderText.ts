import { formatQuantity, type BasketItem } from '../data/basket'
import type { Catalog, Ingredient } from '../types'

export type OrderLineView = {
  ingredientId: string
  name: string
  unit: string
  quantity: number
  addedBy: string | null
  archived: boolean
}

export type OrderGroup = {
  /** null for ingredients with no supplier set. */
  supplierId: string | null
  supplierName: string
  lines: OrderLineView[]
}

const NO_SUPPLIER = 'No supplier'

/**
 * Grouped by supplier, because one message goes to each. Inside a group the
 * kitchen's own walking route is preserved, so the list can still be checked
 * against the shelves in one pass.
 */
export function groupBasket(items: Map<string, BasketItem>, catalog: Catalog): OrderGroup[] {
  const byId = new Map(catalog.ingredients.map((i) => [i.id, i]))
  const locationRank = new Map(catalog.locations.map((l, index) => [l.id, index]))
  const supplierNames = new Map(catalog.suppliers.map((s) => [s.id, s.name]))

  const rows: { ingredient: Ingredient; item: BasketItem }[] = []
  for (const item of items.values()) {
    const ingredient = byId.get(item.ingredient_id)
    // Cascade deletes should make orphans impossible; don't crash if one exists.
    if (ingredient) rows.push({ ingredient, item })
  }

  rows.sort((a, b) => {
    const byLocation =
      (locationRank.get(a.ingredient.location_id) ?? Number.MAX_SAFE_INTEGER) -
      (locationRank.get(b.ingredient.location_id) ?? Number.MAX_SAFE_INTEGER)
    if (byLocation !== 0) return byLocation
    return a.ingredient.sort_order - b.ingredient.sort_order
  })

  const groups = new Map<string, OrderGroup>()
  for (const { ingredient, item } of rows) {
    const key = ingredient.supplier_id ?? ''
    let group = groups.get(key)
    if (!group) {
      group = {
        supplierId: ingredient.supplier_id,
        supplierName: ingredient.supplier_id
          ? (supplierNames.get(ingredient.supplier_id) ?? NO_SUPPLIER)
          : NO_SUPPLIER,
        lines: [],
      }
      groups.set(key, group)
    }
    group.lines.push({
      ingredientId: ingredient.id,
      name: ingredient.name,
      unit: ingredient.unit,
      quantity: item.quantity,
      addedBy: item.added_by,
      archived: ingredient.archived,
    })
  }

  // Named suppliers alphabetically, the unassigned pile last — it's the one
  // that needs a decision before anything can be sent.
  return [...groups.values()].sort((a, b) => {
    if (!a.supplierId) return 1
    if (!b.supplierId) return -1
    return a.supplierName.localeCompare(b.supplierName)
  })
}

export function formatLine(line: OrderLineView): string {
  const unit = line.unit ? ` ${line.unit}` : ''
  return `${line.name} — ${formatQuantity(line.quantity)}${unit}`
}

/** WhatsApp renders *this* as bold, which is the only formatting it gives us. */
export function orderText(groups: OrderGroup[], date = new Date()): string {
  const heading = `Kitchen order · ${date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })}`

  const blocks = groups.map((group) =>
    [`*${group.supplierName}*`, ...group.lines.map((l) => `• ${formatLine(l)}`)].join('\n'),
  )

  return [heading, ...blocks].join('\n\n')
}

export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}
