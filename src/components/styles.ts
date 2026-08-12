/** Shared control styles. Every tap target clears 44px — wet hands, bright room. */

export const input =
  'min-h-[44px] w-full rounded-md border border-rule bg-surface px-3 text-base text-ink outline-none placeholder:text-stone focus:border-ink'

export const select = `${input} appearance-none`

/**
 * The restaurant's reserve button, rebuilt: apricot ground, ink on top, caps at
 * 700 with the site's own .1em tracking and 10px radius.
 */
export const primaryButton =
  'label min-h-[44px] rounded-[10px] bg-apricot px-4 text-base font-bold text-ink disabled:opacity-40'

export const secondaryButton =
  'min-h-[44px] rounded-[10px] border border-rule bg-surface px-4 text-base font-medium text-ink'

export const quietButton = 'min-h-[44px] px-2 text-base text-stone'

/** A link in the anthracite header. Sand on anthracite is 12.51. */
export const headerLink = 'min-h-[44px] px-2 text-base leading-[44px] text-sand'

export const dangerButton = 'min-h-[44px] px-2 text-base text-flag'

/**
 * The station label — a location, a supplier, a dish. Caps on a hairline band,
 * which is how a kitchen labels a shelf.
 */
export const sectionBar =
  'flex items-baseline gap-2 border-y border-rule bg-sand px-4 py-2'

export const sectionName = 'label text-base text-ink'

export const sectionCount = 'text-base text-stone tabular-nums'

/**
 * The view switcher, shared by Order and Catalog. The active tab is a fill, not
 * an underline: an apricot rule on white is 1.37 and disappears, but ink on an
 * apricot ground is 9.67 and reads from across the room.
 */
export function tab(active: boolean): string {
  return `mark min-h-[44px] flex-1 text-base ${
    active ? 'bg-apricot font-semibold text-ink' : 'bg-surface text-stone'
  }`
}
