import type { ReactNode } from 'react'

type Props = {
  title: string
  /** Links or controls, laid out to the right of the title. */
  children?: ReactNode
  /** Sits left of the title — the back link, where a screen has one. */
  leading?: ReactNode
}

/**
 * The anthracite band across the top of every screen. The restaurant's site
 * bands sand against anthracite throughout, and this is the app's half of it.
 *
 * It owns the top safe-area inset rather than <body>, because on a notched
 * phone anything else paints a sand strip above a dark band and reads as a bug.
 */
export function ScreenHeader({ title, children, leading }: Props) {
  return (
    <header className="flex items-center gap-2 bg-ink px-3 pt-[env(safe-area-inset-top)] text-sand">
      {leading}
      <h1 className="label flex-1 py-2 text-xl text-sand">{title}</h1>
      {children}
    </header>
  )
}
