import type { ReactNode } from 'react'
import { columnWidth } from './styles'

type Props = {
  title: string
  /** Links or controls, laid out to the right of the title. */
  children?: ReactNode
  /** Sits left of the title — the back link, where a screen has one. */
  leading?: ReactNode
  /**
   * The width of the content beneath, so the band's contents line up with it.
   * `columnWidth` unless the screen is the wide one — see `styles.ts`.
   */
  width?: string
}

/**
 * The anthracite band across the top of every screen. The restaurant's site
 * bands sand against anthracite throughout, and this is the app's half of it.
 *
 * The band runs edge to edge and its *contents* sit in the same column as the
 * body below. It used to inherit the screen's 672px instead, which no phone can
 * tell apart — but on anything wider it left a short anthracite bar floating in
 * sand above a bottom bar that did span the viewport, and the disagreement
 * between the two read as a broken page.
 *
 * It owns the top safe-area inset rather than <body>, because on a notched
 * phone anything else paints a sand strip above a dark band and reads as a bug.
 */
export function ScreenHeader({ title, children, leading, width = columnWidth }: Props) {
  return (
    <header className="bg-ink pt-[env(safe-area-inset-top)] text-sand">
      <div className={`mx-auto flex ${width} items-center gap-2 px-3`}>
        {leading}
        <h1 className="label flex-1 py-2 text-xl text-sand">{title}</h1>
        {children}
      </div>
    </header>
  )
}
