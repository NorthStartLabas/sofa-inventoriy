import { formatQuantity, type BasketItem } from '../data/basket'
import type { OrderLine } from '../data/orders'
import type { Catalog, Ingredient } from '../types'

/**
 * A row on its way into a message. Both a basket item and a line of an order
 * that has already gone out reduce to this, which is why there is one grouper
 * and not two: the Basket screen and History have to produce byte-identical
 * text, or a re-sent order reads as a different order.
 */
type Groupable = {
  /** React key. The ingredient id for a basket row; the order-line id for a
      past one, since two deleted ingredients in one order both have none. */
  key: string
  /** Null once the ingredient has been deleted — the line outlives it (0004). */
  ingredientId: string | null
  name: string
  unit: string
  quantity: number
  addedBy: string | null
  archived: boolean
}

/**
 * `Id` is `string` for a basket, which cascades and so always has its
 * ingredient, and `string | null` for history, which deliberately does not.
 * That difference is worth carrying in the type: it's what lets the Basket
 * screen step a quantity without a null check, and stops History pretending it
 * can.
 */
export type OrderLineView<Id extends string | null = string | null> = {
  key: string
  ingredientId: Id
  name: string
  unit: string
  quantity: number
  addedBy: string | null
  archived: boolean
}

export type OrderGroup<Id extends string | null = string | null> = {
  /**
   * `sup:<id>` or `loc:<id>`. Prefixed because both halves of a mixed order
   * land in one namespace, and this doubles as a React key and as the marker
   * a screen uses to remember which group it just copied.
   */
  key: string
  /** Grouped by location because nothing in it has a supplier yet. */
  needsSupplier: boolean
  heading: string
  lines: OrderLineView<Id>[]
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
 *
 * The catalog is consulted for **placement only** — which heading a row sits
 * under and where it falls in the route. Every word of the line itself comes
 * off the row that was passed in. See `groupOrder` for why that division is
 * load-bearing rather than incidental.
 */
function groupLines(rows: Groupable[], catalog: Catalog): OrderGroup[] {
  const byId = new Map(catalog.ingredients.map((i) => [i.id, i]))
  const locationRank = new Map(catalog.locations.map((l, index) => [l.id, index]))
  const locationNames = new Map(catalog.locations.map((l) => [l.id, l.name]))
  const supplierNames = new Map(catalog.suppliers.map((s) => [s.id, s.name]))

  const placed = rows.map((row) => ({
    row,
    ingredient: row.ingredientId ? (byId.get(row.ingredientId) ?? null) : null,
  }))

  // An ingredient that no longer exists has no shelf, so it sorts to the end
  // rather than to the front, which is where a missing rank would put it.
  const rank = (i: Ingredient | null) =>
    i ? (locationRank.get(i.location_id) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER

  placed.sort((a, b) => {
    const byLocation = rank(a.ingredient) - rank(b.ingredient)
    if (byLocation !== 0) return byLocation
    return (a.ingredient?.sort_order ?? 0) - (b.ingredient?.sort_order ?? 0)
  })

  // Two maps rather than one, because the two halves are ordered differently
  // and a single map would have to be un-sorted again to separate them.
  const supplierGroups = new Map<string, OrderGroup>()
  const locationGroups = new Map<string, OrderGroup>()

  for (const { row, ingredient } of placed) {
    const supplierId = ingredient?.supplier_id ?? null
    const into = supplierId ? supplierGroups : locationGroups
    const key = supplierId
      ? `sup:${supplierId}`
      : ingredient
        ? `loc:${ingredient.location_id}`
        : // Deleted outright: no supplier, no shelf, nothing left to file it by.
          'loc:gone'

    let group = into.get(key)
    if (!group) {
      group = {
        key,
        needsSupplier: supplierId === null,
        heading: supplierId
          ? // A supplier_id that resolves to nothing means the row was deleted
            // out from under the order; say where the stock is instead.
            (supplierNames.get(supplierId) ??
            locationNames.get(ingredient?.location_id ?? '') ??
            'Elsewhere')
          : (locationNames.get(ingredient?.location_id ?? '') ?? 'Elsewhere'),
        lines: [],
      }
      into.set(key, group)
    }

    group.lines.push({
      key: row.key,
      ingredientId: row.ingredientId,
      name: row.name,
      unit: row.unit,
      quantity: row.quantity,
      addedBy: row.addedBy,
      archived: row.archived,
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

/**
 * The basket as it stands. Names and units come from the catalog because the
 * basket *is* live — nothing has been sent yet, so the current name is the
 * right one.
 */
export function groupBasket(
  items: Map<string, BasketItem>,
  catalog: Catalog,
): OrderGroup<string>[] {
  const byId = new Map(catalog.ingredients.map((i) => [i.id, i]))

  const rows: Groupable[] = []
  for (const item of items.values()) {
    const ingredient = byId.get(item.ingredient_id)
    // Cascade deletes should make orphans impossible; don't crash if one exists.
    if (!ingredient) continue
    rows.push({
      key: ingredient.id,
      ingredientId: ingredient.id,
      name: ingredient.name,
      unit: ingredient.unit,
      quantity: item.quantity,
      addedBy: item.added_by,
      archived: ingredient.archived,
    })
  }

  // Safe: every row above was built from an ingredient that exists.
  return groupLines(rows, catalog) as OrderGroup<string>[]
}

/**
 * An order that has already gone out, ready to send again — for the evening
 * somebody pressed Finish before sending the messages.
 *
 * **The line's own words, the catalog's placement.** `ingredient_name` and
 * `unit` are the snapshot written at send time (migration 0004) and are never
 * looked up: renaming an ingredient must not rewrite what a past order says,
 * and History used to have exactly that bug. `ingredient_id` is used *only* to
 * decide which supplier heading the line sits under, which is the opposite
 * choice and the right one — if the stock has moved supplier since, the message
 * should go to whoever sells it now.
 *
 * Do not "simplify" this by resolving the name too. The two halves disagree on
 * purpose.
 */
export function groupOrder(lines: OrderLine[], catalog: Catalog): OrderGroup[] {
  return groupLines(
    lines.map((line) => ({
      key: line.id,
      ingredientId: line.ingredient_id,
      name: line.ingredient_name,
      unit: line.unit ?? '',
      quantity: line.quantity,
      addedBy: null,
      // Whether the stock is archived *now* says nothing about an order that
      // has already gone out, and the badge it drives is the Basket screen's.
      archived: false,
    })),
    catalog,
  )
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
