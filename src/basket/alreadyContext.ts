import { createContext, useContext } from 'react'
import type { SentToday } from '../data/orders'
import type { OtherBasket } from './basketContext'

/** Both ways something can already be on its way, for one ingredient. */
export type Already = {
  /** Gone out today, in somebody's finished order. */
  sent: SentToday[]
  /** Sitting in somebody else's basket, not sent yet. */
  waiting: OtherBasket[]
}

export type AlreadyValue = {
  /** Null when nobody else has touched this ingredient today. */
  check: (ingredientId: string) => Already | null
  /**
   * Every stepper change on the Order screen goes through here rather than
   * straight to the basket, so the question gets asked in one place.
   */
  step: (ingredientId: string, current: number, next: number) => void
}

export const AlreadyContext = createContext<AlreadyValue | null>(null)

export function useAlready(): AlreadyValue {
  const ctx = useContext(AlreadyContext)
  if (!ctx) throw new Error('useAlready must be used inside <AlreadyProvider>')
  return ctx
}
