/**
 * Shared control styles. Every tap target clears 44px — wet hands, bright room —
 * and that floor does not relax with width: one person on a laptop is not a
 * reason to make the phone in the kitchen worse.
 *
 * Hover states exist for the tablet-and-desktop work. Tailwind v4 already wraps
 * every `hover:` in `@media (hover: hover)`, so no touch device inherits one and
 * gets stuck showing it after a tap.
 */

/**
 * The reading column, shared by the screen body, its header band and any fixed
 * bar, so all three agree on where the content edge is. It widens twice and then
 * stops: past roughly 900px a list of ingredients stops reading as a list and
 * becomes a field of names with a stepper marooned at the far right.
 */
export const columnWidth = 'max-w-2xl md:max-w-3xl lg:max-w-4xl'

/** The Order screen only — at `lg` it puts the basket alongside the column. */
export const wideWidth = 'max-w-2xl md:max-w-3xl lg:max-w-6xl'

export const input =
  'min-h-[44px] w-full rounded-md border border-rule bg-surface px-3 text-base text-ink outline-none placeholder:text-stone hover:border-stone focus:border-ink'

export const select = `${input} appearance-none`

/**
 * The restaurant's reserve button, rebuilt: apricot ground, ink on top, caps at
 * 700 with the site's own .1em tracking and 10px radius.
 */
export const primaryButton =
  'label min-h-[44px] rounded-[10px] bg-apricot px-4 text-base font-bold text-ink disabled:opacity-40 enabled:hover:brightness-95'

export const secondaryButton =
  'min-h-[44px] rounded-[10px] border border-rule bg-surface px-4 text-base font-medium text-ink hover:border-ink'

export const quietButton = 'min-h-[44px] rounded-md px-2 text-base text-stone hover:text-ink'

/** A link in the anthracite header. Sand on anthracite is 12.51. */
export const headerLink =
  'min-h-[44px] rounded-md px-2 text-base leading-[44px] text-sand hover:bg-sand/15'

export const dangerButton =
  'min-h-[44px] rounded-md px-2 text-base text-flag hover:bg-flag-wash'

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
    active
      ? 'bg-apricot font-semibold text-ink hover:brightness-95'
      : 'bg-surface text-stone hover:bg-sand hover:text-ink'
  }`
}
