/**
 * Shared control styles. Every tap target clears 44px — wet hands, bright room —
 * and that floor does not relax with width or with theme: one person on a
 * laptop is not a reason to make the phone in the kitchen worse.
 *
 * Shapes follow the SOFA dashboard: pill controls (its 100px radius), 18px
 * cards, 13px insets, warm elevation. Its *sizes* deliberately do not — a 32px
 * `.iconbtn` and 13px type are for a mouse and a desk.
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
  'min-h-[44px] w-full rounded-[13px] border border-line bg-surface px-3 text-base text-ink outline-none placeholder:text-ink-2 hover:border-line-2 focus:border-wine'

export const select = `${input} appearance-none`

/**
 * The one saturated control. Wine ground, cream on top (7.66), caps at the
 * dashboard's tracking, pill. This is where the restaurant's accent is loudest,
 * and it is loudest on the thing you press to send an order.
 */
export const primaryButton =
  'label min-h-[44px] rounded-full bg-wine px-5 text-base text-cream disabled:opacity-40 enabled:hover:bg-wine-ink'

export const secondaryButton =
  'min-h-[44px] rounded-full border border-line-2 bg-surface px-5 text-base font-medium text-ink hover:border-wine hover:text-wine'

export const quietButton =
  'min-h-[44px] rounded-full px-3 text-base text-ink-2 hover:bg-surface-2 hover:text-ink'

/** A link in the dark band. Cream on the gradient runs 5.38–11.54. */
export const headerLink =
  'min-h-[44px] rounded-full px-3 text-base leading-[44px] text-cream hover:bg-cream/15'

export const dangerButton =
  'min-h-[44px] rounded-full px-3 text-base text-bad hover:bg-bad-bg'

/**
 * The station label — a location, a supplier, a dish. Caps on a hairline band,
 * which is how a kitchen labels a shelf.
 */
export const sectionBar = 'flex items-baseline gap-2 border-y border-line bg-surface-2 px-4 py-2'

export const sectionName = 'label text-base text-ink'

export const sectionCount = 'text-base text-ink-2 tabular-nums'

/**
 * The view switcher, shared by Order and Catalog. The active tab is the same
 * wine fill as the primary button rather than the dashboard's surface-lift: a
 * lift is a lovely signal on a desk and a weak one under a service light, and
 * which list you are looking at is not something to have to work out.
 */
export function tab(active: boolean): string {
  return `mark min-h-[44px] flex-1 text-base ${
    active
      ? 'bg-wine font-semibold text-cream hover:bg-wine-ink'
      : 'bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink'
  }`
}
