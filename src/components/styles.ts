/** Shared control styles. Every tap target clears 44px — wet hands, bright room. */

export const input =
  'min-h-[44px] w-full rounded-md border border-rule bg-surface px-3 text-base text-ink outline-none placeholder:text-steel focus:border-tape'

export const select = `${input} appearance-none`

export const primaryButton =
  'min-h-[44px] rounded-md bg-tape px-4 text-base font-semibold text-white disabled:opacity-40'

export const secondaryButton =
  'min-h-[44px] rounded-md border border-rule bg-surface px-4 text-base font-medium text-ink'

export const quietButton = 'min-h-[44px] px-2 text-base text-steel'

export const dangerButton = 'min-h-[44px] px-2 text-base text-flag'

/**
 * The station label — a location, a supplier, a dish. Condensed caps on a
 * hairline band, which is how a kitchen labels a shelf.
 */
export const sectionBar =
  'flex items-baseline gap-2 border-y border-rule bg-tile px-4 py-2'

export const sectionName = 'label text-base text-ink'

export const sectionCount = 'text-base text-steel tabular-nums'
