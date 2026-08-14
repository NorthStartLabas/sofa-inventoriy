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
  /**
   * `sup:<id>` or `loc:<id>`. Prefixed because both halves of a mixed order
   * land in one namespace, and this doubles as a React key and as the marker
   * the Basket screen uses to remember which group it just copied.
   */
  key: string
  /** Grouped by location because nothing in it has a supplier yet. */
  needsSupplier: boolean
  heading: string
  lines: OrderLineView[]
}

/**
 * Grouped by supplier, because one message goes to each. Inside a group the
 * kitchen's own walking route is preserved, so the list can still be checked
 * against the shelves in one pass.
 *
 * Whatever has no supplier is grouped by location rather than piled under one
 * "No supplier" heading — a heading that reads as a fault in the app to
 * whoever receives the message, and that says nothing about where to find the
 * stock. Locations are the walking route, so an unassigned group can still be
 * checked against the shelves; suppliers get filled in over time and the
 * message improves as they do, instead of being wrong until the day the last
 * one is done.
 *
 * Nothing about the app's own state reaches the text — the heading is the
 * location's name, full stop. "Still needs a supplier" is a note for the
 * kitchen, and the kitchen reads it on the Basket screen, not in a message
 * sent to Hanos.
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

  const locationNames = new Map(catalog.locations.map((l) => [l.id, l.name]))

  // Two maps rather than one, because the two halves are ordered differently
  // and a single map would have to be un-sorted again to separate them.
  const supplierGroups = new Map<string, OrderGroup>()
  const locationGroups = new Map<string, OrderGroup>()

  for (const { ingredient, item } of rows) {
    const assigned = ingredient.supplier_id !== null
    const into = assigned ? supplierGroups : locationGroups
    const key = assigned ? `sup:${ingredient.supplier_id}` : `loc:${ingredient.location_id}`

    let group = into.get(key)
    if (!group) {
      group = {
        key,
        needsSupplier: !assigned,
        heading: assigned
          ? // A supplier_id that resolves to nothing means the row was deleted
            // out from under the basket; say where the stock is instead.
            (supplierNames.get(ingredient.supplier_id!) ??
            locationNames.get(ingredient.location_id) ??
            'Elsewhere')
          : (locationNames.get(ingredient.location_id) ?? 'Elsewhere'),
        lines: [],
      }
      into.set(key, group)
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

  return [
    // Suppliers alphabetically: they're names, and a name is looked up.
    ...[...supplierGroups.values()].sort((a, b) => a.heading.localeCompare(b.heading)),
    // Locations keep the Map's insertion order, which is the route order the
    // rows were sorted into above. Sorting these alphabetically would throw
    // away the one thing grouping by location is for. Last, because these are
    // the ones still waiting on a decision.
    ...locationGroups.values(),
  ]
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
    [`*${group.heading}*`, ...group.lines.map((l) => `• ${formatLine(l)}`)].join('\n'),
  )

  return [heading, ...blocks].join('\n\n')
}

export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}
