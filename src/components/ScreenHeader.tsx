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
 * The band across the top of every screen: the dashboard's `.spotlight`
 * gradient, which is what it uses for a tile that isn't part of the calm cream
 * field. Here it marks the two strips that aren't the list — this and the basket
 * bar. Cream on it runs 5.38 at the gradient's lightest corner to 11.54 at its
 * darkest, so anything written on it reads anywhere along the band.
 *
 * The band runs edge to edge and its *contents* sit in the same column as the
 * body below. It used to inherit the screen's 672px instead, which no phone can
 * tell apart — but on anything wider it left a short dark bar floating above a
 * bottom bar that did span the viewport, and the disagreement between the two
 * read as a broken page.
 *
 * It owns the top safe-area inset rather than <body>, because on a notched
 * phone anything else paints a cream strip above a dark band and reads as a bug.
 */
export function ScreenHeader({ title, children, leading, width = columnWidth }: Props) {
  return (
    <header className="spotlight pt-[env(safe-area-inset-top)]">
      <div className={`mx-auto flex ${width} items-center gap-2 px-3`}>
        {leading}
        <h1 className="label flex-1 py-2 text-xl text-cream">{title}</h1>
        {children}
      </div>
    </header>
  )
}
