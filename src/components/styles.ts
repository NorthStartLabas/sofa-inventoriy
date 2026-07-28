/** Shared control styles. Every tap target clears 44px — wet hands, bright room. */

export const input =
  'min-h-[44px] w-full rounded-lg border border-neutral-300 bg-white px-3 text-base outline-none focus:border-neutral-900'

export const select = `${input} appearance-none`

export const primaryButton =
  'min-h-[44px] rounded-lg bg-neutral-900 px-4 text-base font-semibold text-white disabled:opacity-40'

export const secondaryButton =
  'min-h-[44px] rounded-lg border border-neutral-300 px-4 text-base font-medium text-neutral-900'

export const quietButton = 'min-h-[44px] px-2 text-base text-neutral-500'

export const dangerButton = 'min-h-[44px] px-2 text-base text-red-700'
