import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

type Props<T> = {
  items: T[]
  getId: (item: T) => string
  renderRow: (item: T, dragging: boolean) => ReactNode
  onReorder: (ids: string[]) => void
  /** Rows that are mid-edit drop the handle so the form gets the full width. */
  hideHandle?: (item: T) => boolean
}

type DragState = {
  id: string
  fromIndex: number
  targetIndex: number
  /** Document-space Y, so page scrolling during a drag doesn't skew the maths. */
  startY: number
  currentY: number
  /** Row edges in document space, measured once when the drag begins. */
  edges: { top: number; bottom: number }[]
}

const EDGE_SCROLL_ZONE = 72
const EDGE_SCROLL_STEP = 10

/**
 * Drag-to-reorder built on pointer events rather than HTML5 drag-and-drop,
 * which does not fire on touch at all. Rows stay put while dragging; a line
 * shows where the row will land. Nothing is written until the finger lifts.
 */
export function ReorderList<T>({ items, getId, renderRow, onReorder, hideHandle }: Props<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef(new Map<string, HTMLDivElement>())
  const [drag, setDrag] = useState<DragState | null>(null)

  // Read inside the autoscroll timer, which is created once per drag.
  const dragRef = useRef<DragState | null>(null)
  dragRef.current = drag

  const targetIndexFor = (edges: DragState['edges'], y: number) => {
    const index = edges.findIndex((edge) => y < (edge.top + edge.bottom) / 2)
    return index === -1 ? edges.length : index
  }

  const start = useCallback(
    (event: React.PointerEvent, id: string, fromIndex: number) => {
      // Left button / touch / pen only — a right-click shouldn't grab a row.
      if (event.button !== 0) return
      event.preventDefault()
      // preventDefault on a *mouse* pointerdown doesn't suppress the mousedown
      // that follows, so on a laptop the browser would start selecting text
      // mid-drag. Drop any existing selection and let the container turn
      // selection off for the duration.
      window.getSelection()?.removeAllRanges()
      event.currentTarget.setPointerCapture(event.pointerId)

      const edges = items.map((item) => {
        const el = rowRefs.current.get(getId(item))
        const rect = el!.getBoundingClientRect()
        return { top: rect.top + window.scrollY, bottom: rect.bottom + window.scrollY }
      })
      const y = event.clientY + window.scrollY
      setDrag({ id, fromIndex, targetIndex: fromIndex, startY: y, currentY: y, edges })
    },
    [items, getId],
  )

  const move = useCallback((event: React.PointerEvent) => {
    setDrag((prev) => {
      if (!prev) return prev
      const y = event.clientY + window.scrollY
      return { ...prev, currentY: y, targetIndex: targetIndexFor(prev.edges, y) }
    })
  }, [])

  const end = useCallback(() => {
    setDrag((prev) => {
      if (!prev) return null
      const { fromIndex, targetIndex } = prev
      // Removing the row first shifts everything below it up by one.
      const insertAt = targetIndex > fromIndex ? targetIndex - 1 : targetIndex
      if (insertAt !== fromIndex) {
        const ids = items.map(getId)
        const [moved] = ids.splice(fromIndex, 1)
        ids.splice(insertAt, 0, moved)
        onReorder(ids)
      }
      return null
    })
  }, [items, getId, onReorder])

  // Dragging a row towards the edge of the screen should scroll the page,
  // otherwise a long location can't be reordered on a phone at all.
  useEffect(() => {
    if (!drag) return
    const timer = window.setInterval(() => {
      const current = dragRef.current
      if (!current) return
      const viewportY = current.currentY - window.scrollY
      if (viewportY < EDGE_SCROLL_ZONE) window.scrollBy(0, -EDGE_SCROLL_STEP)
      else if (viewportY > window.innerHeight - EDGE_SCROLL_ZONE) {
        window.scrollBy(0, EDGE_SCROLL_STEP)
      }
    }, 16)
    return () => window.clearInterval(timer)
  }, [drag])

  const containerTop = containerRef.current
    ? containerRef.current.getBoundingClientRect().top + window.scrollY
    : 0

  const indicatorY = drag
    ? (drag.targetIndex < drag.edges.length
        ? drag.edges[drag.targetIndex].top
        : drag.edges[drag.edges.length - 1].bottom) - containerTop
    : 0

  return (
    <div ref={containerRef} className={`relative ${drag ? 'select-none' : ''}`}>
      {drag && (
        <div
          className="pointer-events-none absolute right-0 left-0 z-20 h-0.5 bg-ink"
          style={{ top: indicatorY }}
        />
      )}

      {items.map((item, index) => {
        const id = getId(item)
        const isDragging = drag?.id === id
        return (
          <div
            key={id}
            ref={(el) => {
              if (el) rowRefs.current.set(id, el)
              else rowRefs.current.delete(id)
            }}
            className={isDragging ? 'relative z-10' : undefined}
            style={
              isDragging
                ? {
                    transform: `translateY(${drag.currentY - drag.startY}px)`,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  }
                : undefined
            }
          >
            <div className="flex items-stretch">
              {!hideHandle?.(item) && (
                <button
                  type="button"
                  aria-label="Drag to reorder"
                  // touch-action: none, or the browser scrolls instead of dragging.
                  className="flex w-11 shrink-0 cursor-grab touch-none items-center justify-center text-ink-2 active:cursor-grabbing"
                  onPointerDown={(e) => start(e, id, index)}
                  onPointerMove={move}
                  onPointerUp={end}
                  onPointerCancel={end}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                    <g fill="currentColor">
                      <circle cx="6" cy="3" r="1.5" />
                      <circle cx="10" cy="3" r="1.5" />
                      <circle cx="6" cy="8" r="1.5" />
                      <circle cx="10" cy="8" r="1.5" />
                      <circle cx="6" cy="13" r="1.5" />
                      <circle cx="10" cy="13" r="1.5" />
                    </g>
                  </svg>
                </button>
              )}
              <div className="min-w-0 flex-1">{renderRow(item, isDragging)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
